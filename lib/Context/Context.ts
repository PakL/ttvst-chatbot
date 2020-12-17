import VarInterface from './VarInterface';

const placeholderRegex = /\$\{(\s+)?(?<var>([a-z]([a-z0-9]+)?)(\[(\s+)?(([a-z]([a-z0-9]+)?)|[0-9]+|"(.*?[^\\])?")(\s+)?\])?)(\s+)?\}/;
const variablePartsRegex = /(?<varname>[a-z]([a-z0-9]+)?)(\[(\s+)?(?<index>([a-z]([a-z0-9]+)?)|[0-9]+|"(.*?[^\\])?")(\s+)?\])?/;

class Context {

	private variables: { [name: string]: VarInterface } = {};

	add(...variables: VarInterface[]): this {
		for(let i = 0; i < variables.length; i++) {
			this.variables[variables[i].name] = variables[i];
		}
		return this;
	}

	get(variable: string): VarInterface {
		if(typeof(this.variables[variable]) !== 'undefined') {
			return this.variables[variable];
		}
		return null;
	}

	async valueOf(variable: string): Promise<any> {
		let regex = new RegExp(variablePartsRegex, 'i');
		let matches = variable.match(regex);

		if(matches) {
			let varinf = this.get(matches.groups.varname)
			if(varinf !== null) {
				let result = null;
				let resIndex: string|number = null;
				if(typeof(matches.groups.index) !== 'undefined') {
					if(matches.groups.index.startsWith('"') && matches.groups.index.endsWith('"')) {
						resIndex = matches.groups.index.substr(1, matches.groups.index.length-2);
					} else if(matches.groups.index.match(/^[a-z]/i)) {
						resIndex = await this.valueOf(matches.groups.index);
					} else {
						resIndex = parseInt(matches.groups.index);
					}
				}
				if(resIndex !== null) {
					result = await varinf.getValue(resIndex);
				} else {
					result = await varinf.getValue();
				}
				return result;
			}
		}

		return null;
	}

	async setValueOf(variable: string, value: any) {
		let regex = new RegExp(variablePartsRegex, 'i');
		let matches = variable.match(regex);

		if(matches) {
			let varinf = this.get(matches.groups.varname)
			if(varinf === null) {
				varinf = new VarInterface(matches.groups.varname);
			}
			let resIndex: string|number = null;
			if(typeof(matches.groups.index) !== 'undefined') {
				if(matches.groups.index.startsWith('"') && matches.groups.index.endsWith('"')) {
					resIndex = matches.groups.index.substr(1, matches.groups.index.length-2);
				} else if(matches.groups.index.match(/^[a-z]/i)) {
					resIndex = await this.valueOf(matches.groups.index);
				} else {
					resIndex = parseInt(matches.groups.index);
				}
			}
			if(resIndex !== null) {
				await varinf.setTo(value, resIndex);
			} else {
				await varinf.setTo(value);
			}
		} else {
			regex = new RegExp(placeholderRegex, 'gi');
			matches = regex.exec(variable);

			if(matches !== null) {
				await this.setValueOf(matches.groups.var, value)
			}
		}
	}

	async interpolate(input: string): Promise<string> {
		if(input === null) return null;

		let regex = new RegExp(placeholderRegex, 'gi');
		let match: RegExpExecArray = null;
		let output = '';
		let lastIndex = 0;
		while((match = regex.exec(input)) !== null) {
			output += input.substring(lastIndex, match.index);
			let value = await this.valueOf(match.groups.var);
			if(typeof(value) === 'string') {
				output += value;
			} else if(typeof(value) === 'number') {
				output += value.toString();
			} else if(typeof(value) === 'boolean') {
				output += (value ? '1' : '0');
			} else {
				output += match[0];
			}
			lastIndex = match.index + match[0].length;
		}
		output += input.substring(lastIndex);
		return output;
	}

	async getFirstVariableRaw(input: string): Promise<any> {
		if(input === null) return null;

		let regex = new RegExp(placeholderRegex, 'gi');
		let match: RegExpExecArray = null;
		if((match = regex.exec(input)) !== null) {
			return await this.valueOf(match.groups.var);
		}
		return null;
	}
	
}
export = Context;