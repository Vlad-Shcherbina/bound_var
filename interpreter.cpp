// Compile with -fno-crossjumping

#include <vector>
#include <fstream>
#include <stdio.h>
#include <stdint.h>
#include <assert.h>

using namespace std;

typedef uint32_t u32;

vector<u32> read(const char *filename) {
    ifstream fin(filename, ios_base::binary);
    vector<u32> result;
    while (true) {
        int a = fin.get();
        if (a == EOF) {
            return result;
        }
        u32 x = a;

        a = fin.get();
        assert(a != EOF);
        x <<= 8;
        x |= a;

        a = fin.get();
        assert(a != EOF);
        x <<= 8;
        x |= a;

        a = fin.get();
        assert(a != EOF);
        x <<= 8;
        x |= a;

        result.push_back(x);
    }
}

u32 finger;
u32 reg[8];
vector<vector<u32>> arrays;
vector<u32> abandoned;

u32 allocate(u32 size) {
    if (abandoned.empty()) {
        arrays.emplace_back(size, 0);
        return arrays.size() - 1;
    } else {
        u32 idx = abandoned.back();
        abandoned.pop_back();
        arrays.at(idx).assign(size, 0);
        return idx;
    }
}

#define A ((insn >> 6) & 7)
#define B ((insn >> 3) & 7)
#define C (insn & 7)

void run_switch_interpreter() {
    while (true) {
        u32 insn = arrays[0][finger];
        finger++;
        auto op = insn >> 28;
        switch (op) {
        case 0:
            if (reg[C]) reg[A] = reg[B];
            break;
        case 1:
            reg[A] = arrays[reg[B]][reg[C]];
            break;
        case 2:
            arrays[reg[A]][reg[B]] = reg[C];
            break;
        case 3:
            reg[A] = reg[B] + reg[C];
            break;
        case 4:
            reg[A] = reg[B] * reg[C];
            break;
        case 5:
            reg[A] = reg[B] / reg[C];
            break;
        case 6:
            reg[A] = ~(reg[B] & reg[C]);
            break;
        case 7:
            return;
        case 8:
            reg[B] = allocate(reg[C]);
            break;
        case 9:
            arrays[reg[C]].clear();
            abandoned.push_back(reg[C]);
            break;
        case 10:
            assert(reg[C] <= 255);
            putchar(reg[C]);
            break;
        case 11:
            reg[C] = getchar();
            break;
        case 12:
            if (reg[B]) {
                arrays[0] = arrays[reg[B]];
            }
            finger = reg[C];
            break;
        case 13:
            reg[(insn >> 25) & 7] = insn & ((1 << 25) - 1);
            break;
        default:
            assert(false);
            break;
        }
    }
}

void run_direct_threaded_interpreter() {
    static void *labels[] = {
        &&conditional_move,
        &&array_index,
        &&array_amendment,
        &&addition,
        &&multiplication,
        &&division,
        &&not_and,
        &&halt,
        &&allocation,
        &&abandonment,
        &&output,
        &&input,
        &&load_program,
        &&orthography,
    };
    u32 insn;
    goto *labels[(insn = arrays[0][finger++]) >> 28];
conditional_move:
    if (reg[C]) reg[A] = reg[B];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
array_index:
    reg[A] = arrays[reg[B]][reg[C]];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
array_amendment:
    arrays[reg[A]][reg[B]] = reg[C];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
addition:
    reg[A] = reg[B] + reg[C];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
multiplication:
    reg[A] = reg[B] * reg[C];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
division:
    reg[A] = reg[B] / reg[C];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
not_and:
    reg[A] = ~(reg[B] & reg[C]);
    goto *labels[(insn = arrays[0][finger++]) >> 28];
halt:
    return;
allocation:
    reg[B] = allocate(reg[C]);
    goto *labels[(insn = arrays[0][finger++]) >> 28];;
abandonment:
    arrays[reg[C]].clear();
    abandoned.push_back(reg[C]);
    goto *labels[(insn = arrays[0][finger++]) >> 28];
output:
    assert(reg[C] <= 255);
    putchar(reg[C]);
    goto *labels[(insn = arrays[0][finger++]) >> 28];
input:
    reg[C] = getchar();
    goto *labels[(insn = arrays[0][finger++]) >> 28];
load_program:
    if (reg[B]) {
        arrays[0] = arrays[reg[B]];
    }
    finger = reg[C];
    goto *labels[(insn = arrays[0][finger++]) >> 28];
orthography:
    reg[(insn >> 25) & 7] = insn & ((1 << 25) - 1);
    goto *labels[(insn = arrays[0][finger++]) >> 28];
}

int main() {
    auto program = read("../materials/sandmark.umz");
    arrays.push_back(std::move(program));
    run_direct_threaded_interpreter();
    return 0;
}
