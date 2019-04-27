const VarInterface = require('./VarInterface')

class VarStorage extends VarInterface {

	constructor(name) {
		super(name)

		this.value = Tool.settings.getString('chatbotvar_' + this.name, 'null')
		this.value = JSON.parse(this.value)
	}

	
	save() {
		Tool.settings.setString('chatbotvar_' + this.name, JSON.stringify(this.value))
	}

	setTo(value, index) {
		super.setTo(value, index)
		this.save()
	}

	addTo(value, index) {
		super.addTo(value, index)
		this.save()
	}

} 
module.exports = VarStorage