"use strict";
var output_area = document.getElementById("output");
function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}
// https://stackoverflow.com/a/28151933/6335232
function mult32u(n, m) {
    n >>>= 0;
    m >>>= 0;
    var nlo = n & 0xffff;
    var nhi = n - nlo;
    return ((nhi * m >>> 0) + (nlo * m)) >>> 0;
}
// https://stackoverflow.com/a/6234804/6335232
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
function outputString(s) {
    output_area.innerHTML += s;
}
function outputByte(n) {
    outputString(String.fromCharCode(n));
}
var x = new XMLHttpRequest();
x.onload = function () {
    var data = x.response;
    outputString("Codex loaded (" + data.byteLength + " bytes)\n");
    assert(data.byteLength % 4 === 0);
    var v = new DataView(data);
    arrays[0] = new Uint32Array(data.byteLength / 4);
    for (var i = 0; i < data.byteLength / 4; i++) {
        arrays[0][i] = v.getUint32(4 * i, false /* big endian */);
    }
    finger = 0;
    driver();
};
x.open('GET', 'materials/' + (window.location.hash.substring(1) || 'codex_unpacked.um'));
x.responseType = "arraybuffer";
x.send();
var regs = [0, 0, 0, 0, 0, 0, 0, 0];
var arrays = [null];
var free = [];
var finger = -1;
var pseudoTime = 0;
function run(pseudoTimeLimit, outputByte, inputByte) {
    while (true) {
        if (pseudoTime >= pseudoTimeLimit)
            return "limit";
        var insn = arrays[0][finger++];
        insn >>>= 0;
        var opcode = insn >>> 28;
        if (opcode == 13) {
            // orthography
            var a = (insn >>> 25) & 7;
            var value = insn & ((1 << 25) - 1);
            regs[a] = value;
        }
        else {
            var a = (insn >>> 6) & 7;
            var b = (insn >>> 3) & 7;
            var c = insn & 7;
            switch (opcode) {
                case 0:
                    if (regs[c])
                        regs[a] = regs[b];
                    break;
                case 1:
                    regs[a] = arrays[regs[b]][regs[c]];
                    break;
                case 2:
                    arrays[regs[a]][regs[b]] = regs[c];
                    break;
                case 3:
                    // https://stackoverflow.com/a/6798829/6335232
                    regs[a] = (regs[b] + regs[c]) >>> 0;
                    break;
                case 4:
                    regs[a] = mult32u(regs[b], regs[c]);
                    break;
                case 5:
                    assert(regs[c] != 0);
                    regs[a] = Math.floor(regs[b] / regs[c]);
                    break;
                case 6:
                    regs[a] = (~(regs[b] & regs[c])) >>> 0;
                    break;
                case 7:
                    return "halt";
                case 8:
                    if (free.length > 0) {
                        var i_1 = free.pop();
                        assert(arrays[i_1] === null);
                        arrays[i_1] = new Uint32Array(regs[c]);
                        regs[b] = i_1;
                    }
                    else {
                        arrays.push(new Uint32Array(regs[c]));
                        regs[b] = arrays.length - 1;
                    }
                    pseudoTime += regs[c] / 50;
                    break;
                case 9:
                    arrays[regs[c]] = null;
                    free.push(regs[c]);
                    break;
                case 10:
                    assert(regs[c] >= 0 && regs[c] <= 255);
                    outputByte(regs[c]);
                    break;
                case 11:
                    var i = inputByte();
                    if (i == null) {
                        finger--;
                        pseudoTime--;
                        return "wait_input";
                    }
                    regs[c] = i;
                    break;
                case 12:
                    if (regs[b] != 0) {
                        arrays[0] = arrays[regs[b]].slice();
                        pseudoTime += arrays[0].length / 25;
                    }
                    finger = regs[c];
                    break;
                default:
                    assert(false, 'unrecognized opcode');
            }
        }
        pseudoTime++;
    }
}
var inputBuffer = [];
var fullOutput = [];
var stateElement = document.getElementById('state');
function driver() {
    var buf = '';
    function outputByte(x) {
        buf += escapeHtml(String.fromCharCode(x));
    }
    function inputByte() {
        if (inputBuffer.length === 0)
            return null;
        var x = inputBuffer.shift();
        buf += "<b>" + escapeHtml(String.fromCharCode(x)) + "</b>";
        return x;
    }
    var tr = run(pseudoTime + 10000000, outputByte, inputByte);
    if (buf.length > 0) {
        outputString(buf);
        document.body.scrollTop = document.body.scrollHeight;
    }
    switch (tr) {
        case "halt":
            var blob = new Blob([new Uint8Array(fullOutput)], { 'type': 'application/octet-stream' });
            outputString("<a href=\"" + URL.createObjectURL(blob) + "\">full output</a>\n");
            stateElement.innerHTML = '<i>halted</i>';
            break;
        case "wait_input":
            stateElement.innerHTML = '';
            setTimeout(driver, 100);
            break;
        case "limit":
            stateElement.innerHTML = "<i>running " + (pseudoTime * 1e-9).toFixed(2) + "...<i>";
            setTimeout(driver, 0);
            break;
        default:
            var unreachable = tr;
    }
}
var inputElement = document.getElementById('input');
inputElement.addEventListener("keypress", function (e) {
    if (e.keyCode == 13 && !e.shiftKey) {
        e.preventDefault();
        var s = inputElement.value + '\n';
        for (var i = 0; i < s.length; i++)
            inputBuffer.push(s.charCodeAt(i));
        inputElement.value = '';
    }
});
