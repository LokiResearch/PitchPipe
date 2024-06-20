// ===================
// = Throttled calls =
// ===================
// An object that will call a function F exactly X seconds after the first use of .call(), no matter how many subsequent uses of .call() before the actual execution of F.

class ThrottledCall {
	constructor(fn, time) {
		this.fn = fn
		this.time = time
		this.timer = null
	}
	callFn() {
		this.fn()
		this.timer = null
	}
	cancel() {
		clearTimeout(this.timer)
		this.timer = null
	}
	call() {
		if (this.timer === null) {
			// this.fn()
			this.timer = setTimeout(this.callFn.bind(this), this.time)
		} else { }
	}
}
