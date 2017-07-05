"use strict"

let output_area = <HTMLDivElement>document.getElementById("output");

function assert(condition: boolean, message?: String) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

// https://stackoverflow.com/a/28151933/6335232
function mult32u(n, m)
{
    n >>>= 0;
    m >>>= 0;
    var nlo = n & 0xffff;
    var nhi = n - nlo;
    return ( (nhi * m >>> 0) + (nlo * m) ) >>> 0;
}

// https://stackoverflow.com/a/6234804/6335232
function escapeHtml(unsafe: String): String {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function outputString(s: String) {
    output_area.innerHTML += s
}

function outputByte(n: number) {
    outputString(String.fromCharCode(n))
}

var x = new XMLHttpRequest()
x.onload = function() {
    let data: ArrayBuffer = x.response
    outputString(`Codex loaded (${data.byteLength} bytes)\n`)
    assert(data.byteLength % 4 === 0)
    let v = new DataView(data)
    arrays[0] = new Uint32Array(data.byteLength / 4)
    for (var i = 0; i < data.byteLength / 4; i++) {
        arrays[0]![i] = v.getUint32(4 * i, false /* big endian */)
    }
    finger = 0
    driver()
}
x.open('GET', 'materials/codex_unpacked.um')
x.responseType = "arraybuffer"
x.send()

let regs: number[] = [0, 0, 0, 0, 0, 0, 0, 0]
let arrays: (Uint32Array|null)[] = [null]
let free: number[] = []
let finger: number = -1
let pseudoTime = 0

type TerminationReason = "limit" | "halt" | "wait_input"

function run(
        pseudoTimeLimit: number,
        outputByte: (x: number) => void,
        inputByte: () => number | null): TerminationReason {
    while (true) {
        if (pseudoTime >= pseudoTimeLimit)
            return "limit"
        let insn = arrays[0]![finger++]
        insn >>>= 0
        let opcode = insn >>> 28
        if (opcode == 13) {
            // orthography
            let a = (insn >>> 25) & 7
            let value = insn & ((1 << 25) - 1)
            regs[a] = value;
        } else {
            let a = (insn >>> 6) & 7
            let b = (insn >>> 3) & 7
            let c = insn & 7
            switch (opcode) {
            case 0:  // conditional move
                if (regs[c])
                    regs[a] = regs[b]
                break
            case 1:  // array index
                regs[a] = arrays[regs[b]]![regs[c]]
                break
            case 2:  // array amendment
                arrays[regs[a]]![regs[b]] = regs[c]
                break
            case 3:  // addition
                // https://stackoverflow.com/a/6798829/6335232
                regs[a] = (regs[b] + regs[c]) >>> 0
                break
            case 4:  // multiplication
                regs[a] = mult32u(regs[b], regs[c])
                break
            case 5:  // division
                assert(regs[c] != 0)
                regs[a] = Math.floor(regs[b] / regs[c])
                break
            case 6:  // not-and
                regs[a] = (~(regs[b] & regs[c])) >>> 0
                break
            case 7:  // halt
                return "halt"
            case 8:  // allocation
                if (free.length > 0) {
                    let i = free.pop()!
                    assert(arrays[i] === null)
                    arrays[i] = new Uint32Array(regs[c])
                    regs[b] = i
                } else {
                    arrays.push(new Uint32Array(regs[c]))
                    regs[b] = arrays.length - 1
                }
                pseudoTime += regs[c] / 50
                break
            case 9:  // abandonment
                arrays[regs[c]] = null
                free.push(regs[c])
                break
            case 10:  // output
                assert(regs[c] >= 0 && regs[c] <= 255)
                outputByte(regs[c])
                break
            case 11:  // input
                let i = inputByte()
                if (i == null) {
                    finger--;
                    pseudoTime--;
                    return "wait_input"
                }
                regs[c] = i
                break
            case 12:  // load program
                if (regs[b] != 0) {
                    arrays[0] = arrays[regs[b]]!.slice()
                    pseudoTime += arrays[0]!.length / 25
                }
                finger = regs[c]
                break
            default:
                assert(false, `unrecognized opcode ${opcode}`)
            }
        }
        pseudoTime++;
    }
}

let inputBuffer: number[] = []
let fullOutput: number[] = []

let stateElement = <HTMLDivElement>document.getElementById('state')

function driver() {
    function outputByte(x) {
        outputString(escapeHtml(String.fromCharCode(x)))
        document.body.scrollTop = document.body.scrollHeight
    }
    function inputByte() {
        if (inputBuffer.length === 0)
            return null;
        let x = inputBuffer.shift()!
        outputString(`<b>${escapeHtml(String.fromCharCode(x))}</b>`)
        document.body.scrollTop = document.body.scrollHeight
        return x
    }

    let tr = run(pseudoTime + 10000000, outputByte, inputByte)

    switch (tr) {
    case "halt":
        var blob = new Blob([new Uint8Array(fullOutput)], {'type': 'application/octet-stream'})
        outputString(`<a href="${URL.createObjectURL(blob)}">full output</a>\n`)
        stateElement.innerHTML = '<i>halted</i>'
        break
    case "wait_input":
        stateElement.innerHTML = '<i>waiting for input</i>'
        setTimeout(driver, 100)
        break
    case "limit":
        stateElement.innerHTML = `<i>running ${(pseudoTime * 1e-9).toFixed(2)}...<i>`
        setTimeout(driver, 0)
        break
    default:
        let unreachable: never = tr
    }
}

let inputElement = (<HTMLTextAreaElement>document.getElementById('input'))
inputElement.addEventListener("keypress", function(e) {
    if (e.keyCode == 13) {
        e.preventDefault()
        let s = inputElement.value + '\n'
        for (let i = 0; i < s.length; i++)
            inputBuffer.push(s.charCodeAt(i))
        inputElement.value = ''
    }
})
