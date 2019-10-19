const VarInterface = require('./VarInterface')
const fs = require('fs')

class VarFile extends VarInterface {

	constructor(name)
	{
		super(name)
		this.name = this.name.replace(/%20/g, ' ')
		this.value = ''
	}

	loadFile() {
		try {
			this.value = fs.readFileSync(this.name, { encoding: 'utf8' })
		} catch(e) {}
		let rows = this.value.split('\r\n')
		return rows
	}

	saveFile(rows) {
		this.value = rows.join('\r\n')
		try {
			fs.writeFileSync(this.name, this.value)
		} catch(e) {}
	}

	validateIndex(index) {
		if(typeof(index) == 'string' && index.match(/^[0-9]+$/)) {
			index = parseInt(index)
		}
		if(typeof(index) !== 'number') index = 0
		return index
	}

	getValue(index) {
		const self = this
		return new Promise((y, n) => {
			let rows = self.loadFile()
			index = self.validateIndex(index)
			if(rows.length <= index) {
				index = 0
			}
			y(rows[index])
		})
	}

	setTo(value, index) {
		const self = this
		return new Promise((y, n) => {
			let rows = self.loadFile()
			index = self.validateIndex(index)
			rows[index] = value
			self.saveFile(rows)
			y()
		})
	}

	addTo(value, index) {
		const self = this
		return new Promise((y, n) => {
			let rows = self.loadFile()
			index = self.validateIndex(index)
			if(rows.length <= index) { rows[index] = '' }
			rows[index] += value
			self.saveFile(rows)
			y()
		})
	}

	delete(index) {
		const self = this
		return new Promise((y, n) => {
			let rows = []
			if(typeof(index) == 'string' || typeof(index) == 'number') {
				rows = self.loadFile()
				index = self.validateIndex(index)
				rows[index] = ''
			}
			self.saveFile(rows)
			y()
		})
	}

} 
module.exports = VarFile