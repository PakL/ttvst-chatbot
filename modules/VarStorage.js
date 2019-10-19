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
		const self = this
		return new Promise(async (y, n) => {
			try {
				super.setTo(value, index)
			} catch(e) { console.error(e) }
			self.save()
			y()
		})
	}

	addTo(value, index) {
		const self = this
		return new Promise(async (y, n) => {
			try {
				super.addTo(value, index)
			} catch(e) { console.error(e) }
			self.save()
			y()
		})
	}

	delete(index) {
		const self = this
		return new Promise(async (y, n) => {
			try {
				super.delete(index)
			} catch(e) { console.error(e) }
			self.save()
			y()
		})
	}

} 
module.exports = VarStorage