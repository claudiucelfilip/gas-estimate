package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"syscall/js"

	"github.com/perlin-network/life/compiler"
	"github.com/perlin-network/life/exec"
)

type Resolver struct {
}

// ResolveFunc defines a set of import functions that may be called within a WebAssembly module.
func (r *Resolver) ResolveFunc(module, field string) exec.FunctionImport {
	switch module {
	case "env":
		switch field {
		// case "add":
		// 	return func(vm *exec.VirtualMachine) int64 {
		// 		return vm.GetCurrentFrame().Locals[0] + vm.GetCurrentFrame().Locals[1]
		// 	}

		case "_payload_len":
			return func(vm *exec.VirtualMachine) int64 {
				result := js.Global().Get("imports").Get("env").Call(field)
				return int64(result.Int())
			}
		case "_payload":
			return func(vm *exec.VirtualMachine) int64 {
				ptr := int(uint32(vm.GetCurrentFrame().Locals[0]))
				result := js.Global().Get("imports").Get("env").Call(field, ptr)
				bytes := readJsBytes(result)
				slice := append(bytes, vm.Memory[ptr+len(bytes):]...)
				vm.Memory = append(vm.Memory[:ptr], slice...)
				// panic(bytes)
				// ptr := int(uint32(vm.GetCurrentFrame().Locals[0]))
				// ptr := vm.GetCurrentFrame().Locals[0]
				// return *(*int64)(unsafe.Pointer(&ptr))
				// ptr := int(uint32(vm.GetCurrentFrame().Locals[0]))
				// js.Global().Get("imports").Get("env").Call(field, ptr)
				return 0
			}
		case "_log":
			return func(vm *exec.VirtualMachine) int64 {
				// js.Global().Get("imports").Get("env").Call(field, string(vm.GetCurrentFrame().Locals[0]))
				// return 0
				ptr := int(uint32(vm.GetCurrentFrame().Locals[0]))
				msgLen := int(uint32(vm.GetCurrentFrame().Locals[1]))
				// msg := vm.Memory[ptr : ptr+msgLen]
				// fmt.Printf("[app] %s\n", string(msg))
				js.Global().Get("imports").Get("env").Call(field, ptr, msgLen)
				// panic(string(msg))
				return 0
			}
		}

	}
	panic("import not found:" + module + ":" + field)
}

func (r *Resolver) ResolveGlobal(module, field string) int64 {
	panic("not supported")
}

func readJsBytes(x js.Value) []byte {
	retLen := x.Length()
	ret := make([]byte, retLen)
	for i := 0; i < retLen; i++ {
		ret[i] = byte(x.Index(i).Int())
	}
	return ret
}

func jsRunWithGasLimit(this js.Value, args []js.Value) (retval interface{}) {
	defer func() {
		if err := recover(); err != nil {
			fmt.Println(err)
			retval = nil
		}
	}()

	code := readJsBytes(args[0])

	gasLimit, err := strconv.ParseInt(args[1].String(), 10, 64)
	if err != nil {
		panic(err)
	}

	memory := readJsBytes(args[2])
	entry := args[3].String()

	vm, err := exec.NewVirtualMachine(code, exec.VMConfig{
		DefaultMemoryPages: 128,
		DefaultTableSize:   65536,
		GasLimit:           uint64(gasLimit),
	}, new(Resolver), &compiler.SimpleGasPolicy{GasPerInstruction: 1})

	if err != nil {
		panic(err)
	}

	if len(memory) > 0 {
		vm.Memory = memory
	}

	entryID, ok := vm.GetFunctionExport(entry)
	if !ok {
		panic("Entry function not found")
	}

	// vm.Run(entryID)
	ret, err := vm.Run(entryID)
	if err != nil {
		vm.PrintStackTrace()
		panic(err)
	}

	type Result struct {
		Gas    uint64
		Result string
	}

	res := Result{
		Gas:    vm.Gas,
		Result: fmt.Sprintf("%d", ret),
	}

	b, err := json.Marshal(res)

	if err != nil {
		vm.PrintStackTrace()
		panic(err)
	}

	return string(b)
}

func main() {
	lifeNs := make(map[string]interface{})
	lifeNs["run_with_gas_limit"] = js.FuncOf(jsRunWithGasLimit)

	js.Global().Set("life", lifeNs)
	select {}
}
