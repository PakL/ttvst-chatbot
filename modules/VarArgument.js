const VarInterface = require('./VarInterface')

class VarArgument extends VarInterface {

	constructor(name)
	{
		super(name)
		this.value = name
		if(this.value.match(/^-?([0-9]+)$/)) {
			this.value = parseInt(this.value)
		} else if(this.value.match(/^-?([0-9]+)\.([0-9]+)$/)) {
			this.value = parseFloat(this.value)
		}
	}

	setTo(value, index) { return new Promise((y, n) => { y() }) }

	addTo(value, index) { return new Promise((y, n) => { y() }) }

	delete(index) { return new Promise((y, n) => { y() }) }

} 
module.exports = VarArgument