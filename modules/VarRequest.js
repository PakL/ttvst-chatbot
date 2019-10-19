const VarInterface = require('./VarInterface')
const request = require(path.dirname(module.parent.parent.parent.filename) + '/../node_modules/request')

class VarRequest extends VarInterface {

	constructor(name)
	{
		super(name)
		this.value = null
	}

	getType() {
		return 'string'
	}

	getValue(index) {
		const self = this
		return new Promise((resolve, reject) => {
			if(self.value === null) {
				request.get(self.name, { timeout: 10000 }, (err, resp, body) => {
					if(err) {
						self.value = ''
					} else {
						self.value = body
					}

					resolve(self.value)
				})
			} else {
				resolve(self.value)
			}
		})
	}

	toString() {
		return this.name
	}

	setTo(value, index) { return new Promise((y, n) => { y() }) }

	addTo(value, index) { return new Promise((y, n) => { y() }) }

	delete(index) { return new Promise((y, n) => { y() }) }

} 
module.exports = VarRequest