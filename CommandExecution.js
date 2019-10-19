const VarInterface = require('./modules/VarInterface')
const VarArgument = require('./modules/VarArgument')
const VarRequest = require('./modules/VarRequest')
const VarFile = require('./modules/VarFile')
const VarStorage = require('./modules/VarStorage')
const VarContext = require('./modules/VarContext')

class CommandExecution {

	constructor(addon) {
		this.bot = addon

		this.commands = addon.commands
		this.lastCommandExecution = addon.lastCommandExecution
		this.chat = addon.chat
		this.alttmi = addon.alttmi
		this.auth = addon.auth
		this.tool = addon.tool
		this.i18n = addon.i18n

		this.commandstack = []
	}

	static getPermissionLevels(badges) {
		let levels = ['everybody']
		if(badges.indexOf('Subscriber') >= 0) levels = ['everybody', 'subscribers']
		if(badges.indexOf('VIP') >= 0) levels = ['everybody', 'subscribers', 'vip']
		if(badges.indexOf('Moderator') >= 0) levels = ['everybody', 'subscribers', 'vip', 'moderators']
		if(badges.indexOf('Broadcaster') >= 0) levels = ['everybody', 'subscribers', 'vip', 'moderators', 'broadcaster']
		return levels
	}

	static messageToArgs(message) {
		let args = []
		let argsRegex = /("(.*?)"( |$)|[^ ]+)/gu
		let match = null
		while(match = argsRegex.exec(message)) {
			if(typeof(match[2]) === 'string')
				args.push(match[2])
			else
				args.push(match[1])
		}
		return args
	}

	static hasStatement(message){
		if(message.match(/\{(% ?|\{)(.*?)( ?%|\})\}/s)) {
			return true
		}
		return false
	}

	filterCommands(message, user) {
		let permLevels = CommandExecution.getPermissionLevels(user['badges'])
		let filteredCmds = []
		for(let i = 0; i < this.commands.length; i++) {
			if(!this.commands[i].active) continue
			if(message != this.commands[i].cmd && !message.startsWith(this.commands[i].cmd + ' ')) continue
			if(typeof(this.lastCommandExecution[this.commands[i].id.toString()]) === 'number' && this.lastCommandExecution[this.commands[i].id.toString()] > new Date().getTime() - (this.commands[i].timeout * 1000)) continue
			if(permLevels.indexOf(this.commands[i].permission) < 0) continue

			filteredCmds.push(this.commands[i])
		}
		return filteredCmds
	}

	onMessage(user, msg) {
		let message = msg.msg
		let commands = this.filterCommands(message, user)
		if(commands.length > 0) {
			if(this.commandstack.indexOf(commands[0].id) >= 0) {
				console.log('[chatbot] detected loop and stopped')
				return null
			}
			let args = CommandExecution.messageToArgs(message)
			for(let i = 0; i < commands.length; i++) {
				let cmd = commands[i]
				let points = this.bot.getPoints(user.user)
				if(typeof(cmd.points) !== 'number') cmd.points = 0
				if(points >= cmd.points) {
					this.bot.addPoints(user.user, cmd.points * -1)
					this.executeCommand(msg, cmd, args, this.commandstack)
				}
			}
			return true
		}
		return false
	}

	async executeCommand(msg, cmd, args) {
		console.log('[chatbot] command ' + cmd.cmd + ' is being executed')
		this.lastCommandExecution[cmd.id.toString()] = new Date().getTime()
		let response = cmd.response
		this.commandstack.push(cmd.id)

		if(CommandExecution.hasStatement(response)) {
			if(typeof(args) === 'undefined') args = CommandExecution.messageToArgs(msg.msg)
			console.log('[chatbot] processing: ' + response)
			try {
				response = await this.processStatements(response, args, msg)
			} catch(e) {
				console.error(e)
				response = ''
			}
		}

		this.sendResponse(response)
	}

	sendResponse(response) {
		response = response.replace(/\n/g, ' ')
		response = response.replace(/\t/g, ' ')
		response = response.replace(/\r/g, '')
		response = response.replace(/ +/g, ' ')
		response = response.trim()
		if(response.length > 0) {
			let msgtags = this.chat.usertags[this.auth.username]
			msgtags.emotes = findEmoticons(response, this.tool.cockpit.emoticons_data)
			let userobj = this.chat.getUserObjByTags(this.auth.username, msgtags)

			console.log('[chatbot] response: ' + response)
			let cs = this.onMessage(userobj, {'chn': this.auth.username, 'usr': userobj, 'msg': response, 'uuid': null})
			if(cs === false) {
				if(this.alttmi !== null) {
					this.alttmi.say(this.auth.username, response)
				} else {
					this.chat.sendmsg(this.auth.username, response, this.tool.cockpit.emoticons_data)
				}
			} else if(cs === null) {
				this.chat.showmsg('', '', this.auth.username, this.i18n.__('A command loop was detected and stopped.'), {color: '#999999'}, 1)
			}
		} else {
			console.log('[chatbot] response: ')
			this.chat.showmsg('', '', this.auth.username, this.i18n.__('The command response was empty.'), {color: '#999999'}, 1)
		}
	}


	/**
	 * @param {string} expression 
	 * @param {string[]} args 
	 * @param {object} msg 
	 * @returns {VarInterface}
	 */
	getVarInterface(expression, args, msg) {
		let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z0-9]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+)|📝([a-z]:(.*?)))(\[(.*?)\])?$/i)
		if(matches !== null) {
			let argMatches = matches[1].match(/^%(\-?[0-9]+)(,\-?[0-9]{0,})?$/)
			if(argMatches) {
				let argIndex1 = parseInt(argMatches[1])
				let argIndex2 = (typeof(argMatches[2]) === 'string' ? argMatches[2].substr(1) : (argIndex1+1 == 0 ? undefined : argIndex1+1))
				if(typeof(argIndex2) === 'string') {
					if(argIndex2.length == 0 || (argIndex2.length == 1 && argIndex2 == '-')) {
						argIndex2 = args.length
					}
				}

				let argSlice = args.slice(argIndex1, argIndex2)
				return new VarArgument(argSlice.join(' '))
			} else if(matches[1].match(/^\/[a-z0-9]+$/i)) {
				return new VarContext(matches[1].substr(1).toLowerCase(), msg)
			} else if(matches[1].match(/^\$[a-z0-9]+$/i)) {
				return new VarStorage(matches[1].substr(1))
			} else if(matches[1].match(/^(🔗|🌎|🌍|🌏)https?:\/\/.+$/i)) {
				return new VarRequest(matches[5])
			} else if(matches[1].match(/^📝([a-z]:(.*?))$/i)) {
				return new VarFile(matches[6])
			}
		} else {
			return new VarArgument(expression)
		}
	}

	/**
	 * @param {string} expression 
	 * @param {string[]} args 
	 * @param {object} msg 
	 * @returns {Promise}
	 */
	getVarIndex(expression, args, msg) {
		return new Promise(async (resolve, reject) => {
			try {
				let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z0-9]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+)|📝([a-z]:(.*?)))(\[(.*?)\])?$/i)
				if(matches !== null && typeof(matches[8]) !== 'undefined') {
					let indexStr = matches[8].substr(1, matches[8].length-2)
					let interf = this.getVarInterface(indexStr, args, msg)
					if(interf === null) {
						resolve(null)
					} else {
						resolve(await interf.getValue(indexStr))
					}
				} else {
					resolve(null)
				}
			} catch(e) {
				resolve(null)
			}
		})
	}

	processStatements(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let stmtRegex = /\{\{(.*?)\}\}/gs
			let match = null
			let responseResult = ''
			let lastIndex = 0
			while(match = stmtRegex.exec(response)) {
				responseResult += response.substr(lastIndex, (match.index - lastIndex))
				lastIndex = match.index+match[0].length

				let statment = match[1]
				let encodeAfter = false
				if(statment.startsWith('§') && statment.endsWith('§')) {
					encodeAfter = true
					statment = statment.substr(1, statment.length-2)
				}
				
				statment.trim()

				let stmtArgs = CommandExecution.messageToArgs(statment)
				if(stmtArgs.length > 0) {
					stmtArgs.unshift('print')
					try {
						let stmtResult = await self.processStmtPrint(stmtArgs, args, msg)
						if(encodeAfter) {
							stmtResult = encodeURIComponent(stmtResult)
						}
						responseResult += stmtResult
					} catch(e) {
						console.error(e)
					}
				}
			}
			responseResult += response.substr(lastIndex)
	
			responseResult = await self.processConditionals(responseResult, args, msg)

			resolve(responseResult)
		})
	}

	processConditionals(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let ifRegex = /\{% ?if (.*?) ?%\}/igs
			let elseRegex = /\{% ?else ?%\}/igs
			let endifRegex = /\{% ?endif ?%\}/igs
			let waitRegex = /\{% ?wait ([0-9]+) ?%\}/igs

			let conditionals = []
			while(match = ifRegex.exec(response))		{ match.g = 1; conditionals.push(match) }
			while(match = elseRegex.exec(response))		{ match.g = 2; conditionals.push(match) }
			while(match = endifRegex.exec(response))	{ match.g = 3; conditionals.push(match) }
			while(match = waitRegex.exec(response))		{ match.g = 4; conditionals.push(match) }

			conditionals.sort((a, b) => {
				return a.index - b.index
			})

			let responseAfter = ''
			let ifDepth = -1
			let lastIndex = 0
			let lastIf = []

			if(conditionals.length > 0) {
				responseAfter = await self.processLowPrioStatements(response.substring(0, conditionals[0].index), args, msg)
				lastIndex = conditionals[0].index
			}

			for(let i = 0; i < conditionals.length; i++) {
				let cond = conditionals[i]
				if(cond.index < lastIndex) continue
				let conditionMet = false
				switch(cond.g) {
					case 1:
						ifDepth++
						if(lastIf.indexOf(false) < 0) {
							let ifArgs = CommandExecution.messageToArgs(cond[1])
							let condResult = false
							try {
								condResult = await self.processStmtCondition(ifArgs, args, msg)
							} catch(e) { console.error(e) }
							lastIf.push(condResult)
							conditionMet = condResult
						} else {
							lastIf.push(false)
						}
						break
					case 2:
						if((ifDepth >= 0 && lastIf.length > ifDepth && !lastIf[ifDepth]) || ifDepth < 0) {
							conditionMet = true
							for(let i = 0; i < ifDepth; i++) {
								if(!lastIf[i]) conditionMet = false
							}
						}
						break
					case 3:
						conditionMet = true
						if(ifDepth > -1) {
							ifDepth--
							lastIf.pop()
						}
						break
					case 4:
						conditionMet = true
						this.sendResponse(responseAfter)
						responseAfter = ''
						let wait = parseInt(cond[1]) * 1000
						await new Promise(res => { setTimeout(() => res(), wait) })
						break
				}

				lastIndex = cond.index + cond[0].length

				let nextIndex = -1
				if(conditionals.length > i+1) nextIndex = conditionals[i+1].index
				else nextIndex = response.length

				if(conditionMet) {
					try {
						responseAfter += await self.processLowPrioStatements(response.substring(lastIndex, nextIndex), args, msg)
					} catch(e) { console.error(e) }
				}
				lastIndex = nextIndex
				
			}
			try {
				responseAfter += await self.processLowPrioStatements(response.substring(lastIndex), args, msg)
			} catch(e) { console.error(e) }

			resolve(responseAfter)
		})
	}

	processLowPrioStatements(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let stmtRegex = /\{% ?(.*?) ?%\}/gs
			let match = null
			let responseResult = ''
			let lastIndex = 0
			while(match = stmtRegex.exec(response)) {
				responseResult += response.substr(lastIndex, (match.index - lastIndex))
				lastIndex = match.index+match[0].length

				try {
					let stmtArgs = CommandExecution.messageToArgs(match[1])
					if(stmtArgs.length > 0) {
						if(stmtArgs[0].toLowerCase() == 'set' && stmtArgs.length >= 4) {
							await self.processStmtSet(stmtArgs, args, msg)
						} else if((stmtArgs[0].toLowerCase() == 'add' || stmtArgs[0].toLowerCase() == 'sub') && stmtArgs.length >= 4) {
							await self.processStmtAdd(stmtArgs, args, msg)
						} else if(stmtArgs[0].toLowerCase() == 'print' && stmtArgs.length >= 2) {
							responseResult += await self.processStmtPrint(stmtArgs, args, msg)
						}
					}
				} catch(e) {
					console.error(e)
				}
			}

			responseResult += response.substr(lastIndex)
			resolve(responseResult)
		})
	}

	processStmtSet(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)
				let var2 = self.getVarInterface(stmt[3], args, msg)
				let var2Index = await self.getVarIndex(stmt[3], args, msg)

				if(var1 === null || var2 === null) {
					resolve()
					return
				}
				if(['into', '>', '->'].indexOf(stmt[2]) >= 0) {
					await var2.setTo(await var1.getValue(var1Index), var2Index)
				} else if(['<', '<-'].indexOf(stmt[2]) >= 0) {
					await var1.setTo(await var2.getValue(var2Index), var1Index)
				}
			} catch(e) {
				console.error(e)
			}

			resolve()
		})
	}

	processStmtAdd(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)
				let var2 = self.getVarInterface(stmt[3], args, msg)
				let var2Index = await self.getVarIndex(stmt[3], args, msg)

				if(var1 === null || var2 === null) {
					resolve()
					return
				}
				if(stmt[0].toLowerCase() == 'add' && ['>', '->', 'to'].indexOf(stmt[2]) >= 0) {
					await var2.addTo(await var1.getValue(var1Index), var2Index)
				} else if(stmt[0].toLowerCase() == 'add' && ['<', '<-'].indexOf(stmt[2]) >= 0) {
					await var1.addTo(await var2.getValue(var2Index), var1Index)
				} else if(stmt[0].toLowerCase() == 'sub' && stmt[2] == 'from'){
					let val = await var1.getValue(var1Index)
					if((typeof(val) === 'string' && val.match(/^-?([0-9]+)(\.([0-9]+))?$/))) {
						val = parseFloat(val)
					}
					if(typeof(val) === 'number') {
						val = val * -1;
						await var2.addTo(val, var2Index)
					}
				}
			} catch(e) {
				console.error(e)
			}

			resolve()
		})
	}

	processStmtPrint(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)

				if(var1 === null) {
					resolve('')
					return
				}
				let value = await var1.getValue(var1Index)
				if(typeof(value) === 'string' || typeof(value) === 'number') {
					resolve(value.toString())
					return
				}
			} catch(e) {
				console.error(e)
			}
	
			resolve('')
		})
	}

	processStmtCondition(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[0], args, msg)
				let var1Index = await self.getVarIndex(stmt[0], args, msg)
				let var2 = self.getVarInterface(stmt[2], args, msg)
				let var2Index = await self.getVarIndex(stmt[2], args, msg)

				if(var1 === null && var2 === null) {
					resolve(false)
					return
				}

				let var1Value = (var1 === null ? null : await var1.getValue(var1Index))
				let var2Value = (var2 === null ? null : await var2.getValue(var2Index))
				if(stmt[1] == '>') {
					resolve(var1Value > var2Value)
				} else if(stmt[1] == '<') {
					resolve(var1Value < var2Value)
				} else if(stmt[1] == '>=') {
					resolve(var1Value >= var2Value)
				} else if(stmt[1] == '<=') {
					resolve(var1Value <= var2Value)
				} else if(['=', '=='].indexOf(stmt[1]) >= 0) {
					resolve(var1Value == var2Value)
				} else if(['!=', '!'].indexOf(stmt[1]) >= 0) {
					resolve(var1Value != var2Value)
				} else if(stmt[1].toLowerCase() == 'includes') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.includes(var2Value))
					} else {
						resolve(false)
					}
				} else if(stmt[1].toLowerCase() == 'startswith') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.startsWith(var2Value))
					} else {
						resolve(false)
					}
				} else if(stmt[1].toLowerCase() == 'endswith') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.endswith(var2Value))
					} else {
						resolve(false)
					}
				} else {
					resolve(false)
				}
				return
			} catch(e) {
				console.error(e)
			}

			resolve(false)
		})
	}
}

module.exports = CommandExecution