import Context from '../Context/Context';

export interface IFlowVariable {
	discriminator: 'FlowVariable',
	variable: string,
	type: 'number'|'string'|'boolean'|'array'|'object',
	content: number|string|boolean|Array<string|number>|{[key: string]: string},
	processing: 'none'|'split'|'join'|'enjson'|'dejson'|'enbase64'|'debase64'|'urlencode'|'urldecode'|'append'|'prepend'|'shift'|'pop'|'searchremove'|'searchreplace'|'substring',
	processingextra: string
}

class FlowVariable {

	data: IFlowVariable;

	constructor(data: IFlowVariable) {
		this.data = data;
	}

	async execute(context: Context): Promise<{ [key: string]: any }> {
		let value: any;

		if(this.data.type == 'number') {
			let content: number|string = 0;
			if(typeof(this.data.content) === 'string') {
				if(this.data.processing === 'shift') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.shift();
						await context.setValueOf(this.data.content, varContent);
					}
				} else if(this.data.processing === 'pop') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.pop();
						await context.setValueOf(this.data.content, varContent);
					}
				} else {
					content = await context.interpolate(this.data.content);
				}
			} else if(typeof(this.data.content) === 'number') {
				content = this.data.content;
			}
			if(typeof(content) !== 'number') {
				let temp = parseFloat(content);
				if(!isNaN(temp)) content = temp;
				else content = 0;
			}
			value = content;
		} else if(this.data.type == 'string') {
			let content: string = '';
			if(typeof(this.data.content) === 'string') {
				content = await context.interpolate(this.data.content);
				if(this.data.processing === 'urlencode') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && typeof(varContent) === 'object') {
						let keys = Object.keys(varContent);
						for(let i = 0; i < keys.length; i++) {
							if(i > 0) content += '&';
							content += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(varContent[keys[i]]);
						}
					} else {
						content = encodeURIComponent(content);
					}
				} else if(this.data.processing === 'urldecode') {
					content = decodeURIComponent(content);
				} else if(this.data.processing === 'append') {
					let varContent = await context.valueOf(this.data.variable);
					if(typeof(varContent) === 'string') {
						content = varContent + content;
					}
				} else if(this.data.processing === 'prepend') {
					let varContent = await context.valueOf(this.data.variable);
					if(typeof(varContent) === 'string') {
						content = content + varContent;
					}
				} else if(this.data.processing === 'join') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						if(this.data.processingextra.length <= 0) this.data.processingextra = ' ';
						content = varContent.join(this.data.processingextra);
					}
				} else if(this.data.processing === 'shift') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.shift();
						await context.setValueOf(this.data.content, varContent);
					}
				} else if(this.data.processing === 'pop') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.pop();
						await context.setValueOf(this.data.content, varContent);
					}
				} else if(this.data.processing === 'enjson') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					try {
						content = JSON.stringify(varContent);
					} catch(e) {}
				} else if(this.data.processing === 'enbase64') {
					let varContent = await context.interpolate(this.data.content);
					try {
						content = Buffer.from(varContent, 'utf-8').toString('base64');
					} catch(e) {}
				} else if(this.data.processing === 'debase64') {
					let varContent = await context.interpolate(this.data.content);
					try {
						content = Buffer.from(varContent, 'base64').toString('utf-8');
					} catch(e) {}
				} else if(this.data.processing === 'searchreplace') {
					let extra: { needle: string, regexp: boolean, global: boolean, ignorecase: boolean, replace: string } = { needle: '', regexp: false, global: false, ignorecase: false, replace: '' };
					try {
						extra = Object.assign(extra, JSON.parse(this.data.processingextra));
					} catch(e) {}

					extra.replace = await context.interpolate(extra.replace);
					if(!extra.regexp) {
						extra.needle = extra.needle.replace(/[\\\^\$\.\|\?\*\+\(\)\[\]\{\}]/g, '\\$&');
						extra.replace = extra.replace.replace(/\$/g, '$$$$');
					}

					try {
						let r = new RegExp(extra.needle, (extra.global ? 'g' : '')+(extra.ignorecase ? 'i' : ''));
						content = content.replace(r, extra.replace);
					} catch(e) {}
				} else if(this.data.processing === 'substring') {
					let extra: { index: string|number, length: string|number } = { index: 0, length: 0 };
					try {
						extra = Object.assign(extra, JSON.parse(this.data.processingextra));
					} catch(e) {}

					if(typeof(extra.index) !== 'number') {
						extra.index = await context.interpolate(extra.index);
						extra.index = parseInt(extra.index);
					}
					if(typeof(extra.length) !== 'number') {
						extra.length = await context.interpolate(extra.length);
						extra.length = parseInt(extra.length);
					}

					if(!isNaN(extra.index) && !isNaN(extra.length)) {
						if(extra.length < 1) delete extra.length;
						content = content.substr(extra.index, extra.length as number);
					}
					console.log(content);
				}
			}
			value = content;
		} else if(this.data.type == 'boolean') {
			if(typeof(this.data.content) === 'boolean') {
				value = this.data.content;
			} else if(typeof(this.data.content) === 'string') {
				let content: boolean|string = false;
				if(this.data.processing === 'shift') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.shift();
						await context.setValueOf(this.data.content, varContent);
					}
				} else if(this.data.processing === 'pop') {
					let varContent = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						content = varContent.pop();
						await context.setValueOf(this.data.content, varContent);
					}
				} else {
					content = await context.interpolate(this.data.content);
				}

				if(typeof(content) !== 'boolean') {
					if(content.toLowerCase() === 'false') {
						content = false;
					} else if(content === '0') {
						content = false;
					} else {
						content = content.length > 0;
					}
				}
				value = content;
			}
		} else if(this.data.type == 'array') {
			let content : Array<string|number> = [];
			if(typeof(this.data.content) === 'object' && Array.isArray(this.data.content)) {
				content = this.data.content;

				for(let i = 0; i < content.length; i++) {
					if(typeof(content[i]) === 'string')
						content[i] = await context.interpolate(content[i] as string);
				}
			} else if(typeof(this.data.content) === 'string') {
				let contentStr = await context.interpolate(this.data.content);
				if(this.data.processing === 'split') {
					if(this.data.processingextra.length <= 0) this.data.processingextra = ' ';
					content = contentStr.split(this.data.processingextra);
				} else if(this.data.processing === 'dejson') {
					try {
						let jsonContent = JSON.parse(contentStr);
						if(typeof(jsonContent) === 'object' && Array.isArray(jsonContent)) {
							for(let i = 0; i < jsonContent.length; i++) {
								if(['string','number','boolean'].indexOf(typeof(jsonContent[i])) < 0) {
									jsonContent[i] = JSON.stringify(jsonContent[i]);
								}
							}
							content = jsonContent;
						}
					} catch(e) {}
				} else if(this.data.processing === 'append') {
					let varContent = await context.valueOf(this.data.variable);
					let contentVal = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						if(contentVal !== null && Array.isArray(contentVal)) {
							content = varContent.concat(contentVal);
						} else if(typeof(contentVal) === 'string' || typeof(contentVal) === 'number' || typeof(contentVal) === 'boolean') {
							if(typeof(contentVal) === 'string') {
								contentVal = contentStr;
							}
							varContent.push(contentVal);
							content = varContent;
						}
					}
				} else if(this.data.processing === 'prepend') {
					let varContent = await context.valueOf(this.data.variable);
					let contentVal = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent)) {
						if(contentVal !== null && Array.isArray(contentVal)) {
							content = contentVal.concat(varContent);
						} else if(typeof(contentVal) === 'string' || typeof(contentVal) === 'number' || typeof(contentVal) === 'boolean') {
							if(typeof(contentVal) === 'string') {
								contentVal = contentStr;
							}
							varContent.unshift(contentVal);
							content = varContent;
						}
					}
				} else if(this.data.processing === 'searchremove') {
					let varContent = await context.valueOf(this.data.variable);
					if(varContent !== null && Array.isArray(varContent)) {
						let index = varContent.indexOf(contentStr);
						if(index >= 0) {
							varContent.splice(index, 1);
						}
						content = varContent;
					}
				}
			}
			value = content;
		} else if(this.data.type == 'object') {
			let content : {[key: string]: string} = {};
			if(typeof(this.data.content) === 'object' && !Array.isArray(this.data.content)) {
				let dataContent: {[key: string]: string} = this.data.content;
				let keys = Object.keys(dataContent);
				for(let i = 0; i < keys.length; i++) {
					content[await context.interpolate(keys[i])] = await context.interpolate(dataContent[keys[i]]);
				}
			} else if(typeof(this.data.content) === 'string') {
				let contentStr = await context.interpolate(this.data.content);
				if(this.data.processing === 'dejson') {
					try {
						let jsonContent = JSON.parse(contentStr);
						if(jsonContent !== null && typeof(jsonContent) === 'object' && !Array.isArray(jsonContent)) {
							for(let i of Object.keys(jsonContent)) {
								if(['string','number','boolean'].indexOf(typeof(jsonContent[i])) < 0) {
									jsonContent[i] = JSON.stringify(jsonContent[i]);
								}
							}
							content = jsonContent;
						}
					} catch(e) {}
				} else if(this.data.processing === 'urldecode') {
					let vars = contentStr.split('&');
					for(let i = 0; i < vars.length; i++) {
						let s = vars[i].split('=', 2);
						if(s.length != 2) continue;
						content[decodeURIComponent(s[0])] = decodeURIComponent(s[1]);
					}
				} else if(this.data.processing === 'append') {
					let varContent = await context.valueOf(this.data.variable);
					let contentVal = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && typeof(varContent) === 'object' && !Array.isArray(varContent) &&
						contentVal !== null && typeof(contentVal) === 'object' && !Array.isArray(contentVal)) {
						content = Object.assign(varContent, contentVal);
					}
				} else if(this.data.processing === 'searchremove') {
					let varContent = await context.valueOf(this.data.variable);
					if(varContent !== null && typeof(varContent) === 'object' && !Array.isArray(varContent)) {
						if(typeof(varContent[contentStr]) !== 'undefined') {
							delete varContent[contentStr];
						}
						content = varContent;
					}
				}
			}
			value = content;
		}


		if(typeof(value) === this.data.type || (typeof(value) === 'object' && this.data.type === 'array' && Array.isArray(value))) {
			await context.setValueOf(this.data.variable, value);
			return { variable: this.data.variable, value };
		} else {
			return { msg: 'Nothing happend' };
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowVariable;