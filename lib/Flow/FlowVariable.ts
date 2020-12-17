import { threadId } from 'worker_threads';
import Context from '../Context/Context';

export interface IFlowVariable {
	discriminator: 'FlowVariable',
	variable: string,
	type: 'number'|'string'|'boolean'|'array'|'object',
	content: number|string|boolean|Array<string|number>|{[key: string]: string},
	processing: 'none'|'split'|'join'|'enjson'|'dejson'|'urlencode'|'urldecode'|'append'|'prepend'|'shift'|'pop',
	processingextra: string
}

class FlowVariable {

	data: IFlowVariable;

	constructor(data: IFlowVariable) {
		this.data = data;
	}

	async execute(context: Context) {
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
			}
			if(typeof(content) !== 'number') {
				let temp = parseFloat(content);
				if(!isNaN(temp)) content = temp;
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
					if(varContent !== null && typeof(varContent) === 'object') {
						try {
							content = JSON.stringify(varContent);
						} catch(e) {}
					}
				}
			}
			value = content;
		} else if(this.data.type == 'boolean') {
			if(typeof(this.data.content) === 'boolean') {
				value = this.data.content;
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
							content = jsonContent;
						}
					} catch(e) {}
				} else if(this.data.processing === 'append') {
					let varContent = await context.valueOf(this.data.variable);
					let contentVal = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent) && contentVal !== null && Array.isArray(contentVal)) {
						content = varContent.concat(contentVal);
					}
				} else if(this.data.processing === 'prepend') {
					let varContent = await context.valueOf(this.data.variable);
					let contentVal = await context.getFirstVariableRaw(this.data.content);
					if(varContent !== null && Array.isArray(varContent) && contentVal !== null && Array.isArray(contentVal)) {
						content = contentVal.concat(varContent);
					}
				}
			}
		} else if(this.data.type == 'object') {
			let content : {[key: string]: string} = {};
			if(typeof(this.data.content) === 'object' && !Array.isArray(this.data.content)) {
				content = this.data.content;
			} else if(typeof(this.data.content) === 'string') {
				let contentStr = await context.interpolate(this.data.content);
				if(this.data.processing === 'dejson') {
					try {
						let jsonContent = JSON.parse(contentStr);
						if(jsonContent !== null && typeof(jsonContent) === 'object' && !Array.isArray(jsonContent)) {
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
				}
			}
		}

		if(typeof(value) === this.data.type) {
			context.setValueOf(this.data.variable, value);
		}
	}

	serialize() {
		return this.data;
	}

}
export default FlowVariable;