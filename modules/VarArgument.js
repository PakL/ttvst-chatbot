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

	setTo(value, index) {}

	addTo(value, index) {}

} 
module.exports = VarArgument