import Context from './Context/Context';
import * as stringSimilarity from 'string-similarity';

export enum IConditionCompare {
	EQUALS = 'eq',
	NOT_EQUAL = 'not',
	GREATER = 'gt',
	GREATER_OR_EQUALS = 'ge',
	LESS = 'lt',
	LESSER_OR_EQUALS = 'le',

	CONTAINS = 'contains',
	SIMILAR = 'similar',
	MATCH = 'match',
	MATCHI = 'matchi',
	LIKE = 'like',
	HAS = 'has',

	NOT_CONTAINS = 'notcontains',
	NOT_SIMILAR = 'notsimilar',
	NOT_MATCH = 'notmatch',
	NOT_MATCHI = 'notmatchi',
	NOT_LIKE = 'notlike',
	NOT_HAS = 'nothas',

	EQUALS_NOCASE = 'eqc',
	NOT_EQUAL_NOCASE = 'notc',
	STARTS_WITH = 'starts',
	ENDS_WITH = 'ends',
	STARTS_WITH_NOCASE = 'startsc',
	ENDS_WITH_NOCASE = 'endsc',

	IS_TRUE = 'true',
	IS_FALSE = 'false',
	EXISTS = 'exists',
	NOT_EXISTS = 'nexists'
}

const readableCompare: {[key: string]: string} = {
	eq: '==',
	not: '!=',
	gt: '>',
	ge: '>=',
	lt: '<',
	le: '<=',

	contains: 'contains',
	similar: 'is similar to',
	match: 'matches regex',
	matchi: 'matches regex(i)',
	like: 'is like',
	has: 'has',

	notcontains: 'does not contain',
	notsimilar: 'is not similar to',
	notmatch: 'not matches regex',
	notmatchi: 'not matches regex(i)',
	notlike: 'is not like',
	nothas: 'has not',
	
	eqc: '==(i)',
	notc: '!=(i)',
	starts: 'starts with',
	ends: 'ends with',
	startsc: 'starts with(i)',
	endsc: 'ends with(i)',
	true: 'is true',
	false: 'is false',
	exists: 'exists',
	nexists: 'not exists'
}

export interface ICondition {
	discriminator: 'Condition',
	left: string,
	right: string,
	compare: IConditionCompare
}

class Conditional {
	
	discriminator = 'Condition';

	private condition: ICondition;

	constructor(condition: ICondition) {
		this.condition = condition;
	}

	async meets(context: Context): Promise<boolean> {
		let left = await context.interpolate(this.condition.left);
		let right = await context.interpolate(this.condition.right);
		let leftNum = NaN;
		let rightNum = NaN;
		
		if(left.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
			leftNum = parseFloat(left);
		}
		if(right.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
			rightNum = parseFloat(right);
		}

		switch(this.condition.compare) {
			case IConditionCompare.EQUALS:
				return left === right;
			case IConditionCompare.NOT_EQUAL:
				return left !== right;
			case IConditionCompare.GREATER:
				if(!isNaN(leftNum) && !isNaN(rightNum)) {
					return leftNum > rightNum;
				}
				return left.localeCompare(right) > 0 ? true : false;
			case IConditionCompare.GREATER_OR_EQUALS:
				if(!isNaN(leftNum) && !isNaN(rightNum)) {
					return leftNum >= rightNum;
				}
				return left.localeCompare(right) >= 0 ? true : false;
			case IConditionCompare.LESS:
				if(!isNaN(leftNum) && !isNaN(rightNum)) {
					return leftNum < rightNum;
				}
				return left.localeCompare(right) < 0 ? true : false;
			case IConditionCompare.LESSER_OR_EQUALS:
				if(!isNaN(leftNum) && !isNaN(rightNum)) {
					return leftNum <= rightNum;
				}
				return left.localeCompare(right) <= 0 ? true : false;
			
			case IConditionCompare.CONTAINS:
				return await this.contains(context, right);
			case IConditionCompare.SIMILAR:
				return stringSimilarity.compareTwoStrings(left, right) >= 0.6;
			case IConditionCompare.MATCH:
				try {
					let reg = new RegExp(right);
					if(left.match(reg)) {
						return true;
					}
				} catch(e){}
				return false;
			case IConditionCompare.MATCHI:
				try {
					let reg = new RegExp(right, 'i');
					if(left.match(reg)) {
						return true;
					}
				} catch(e){}
				return false;
			case IConditionCompare.LIKE:
				right = right
							.replace(/[\(\)\[\]\{\}\.\*\?\\\/\^\$\+\-]/g, '\\$&')
							.replace(/%/g, '(.*?)')
							.replace(/_/g, '.');
				right = `^${right}$`;
				return left.match(new RegExp(right, 'i')) ? true : false;
			case IConditionCompare.HAS:
				return await this.has(context, right);

			case IConditionCompare.NOT_CONTAINS:
				return !(await this.contains(context, right));
			case IConditionCompare.NOT_SIMILAR:
				return stringSimilarity.compareTwoStrings(left, right) < 0.6;
			case IConditionCompare.NOT_MATCH:
				try {
					let reg = new RegExp(right);
					if(left.match(reg)) {
						return false;
					}
				} catch(e){}
				return true;
			case IConditionCompare.NOT_MATCHI:
				try {
					let reg = new RegExp(right, 'i');
					if(left.match(reg)) {
						return false;
					}
				} catch(e){}
				return true;
			case IConditionCompare.NOT_LIKE:
				right = right
							.replace(/[\(\)\[\]\{\}\.\*\?\\\/\^\$\+\-]/g, '\\$&')
							.replace(/%/g, '(.*?)')
							.replace(/_/g, '.');
				right = `^${right}$`;
				return left.match(new RegExp(right, 'i')) ? false : true;
			case IConditionCompare.NOT_HAS:
				return !(await this.has(context, right));

			case IConditionCompare.EQUALS_NOCASE:
				return left.toLocaleLowerCase() === right.toLocaleLowerCase();
			case IConditionCompare.NOT_EQUAL_NOCASE:
				return left.toLocaleLowerCase() !== right.toLocaleLowerCase();
			case IConditionCompare.STARTS_WITH:
				return left.startsWith(right);
			case IConditionCompare.ENDS_WITH:
				return left.endsWith(right);
			case IConditionCompare.STARTS_WITH_NOCASE:
				return left.toLocaleLowerCase().startsWith(right.toLocaleLowerCase());
			case IConditionCompare.ENDS_WITH_NOCASE:
				return left.toLocaleLowerCase().endsWith(right.toLocaleLowerCase());

			case IConditionCompare.IS_TRUE:
				return await this.is(context);
			case IConditionCompare.IS_FALSE:
				return !await this.is(context);
			case IConditionCompare.EXISTS:
				return await this.exists(context);
			case IConditionCompare.NOT_EXISTS:
				return !await this.exists(context);
		}

		return false;
	}

	private async contains(context: Context, right: string): Promise<boolean> {
		let left = await context.getFirstVariableRaw(this.condition.left);
		if(typeof(left) === 'object' && left !== null) {
			if(Array.isArray(left) && left.indexOf(right) >= 0) {
				return true;
			} else if(!Array.isArray(left)) {
				for(let key of Object.keys(left)) {
					if(left[key] == right) {
						return true;
					}
				}
			}
			return false;
		} else if(typeof(left) === 'string') {
			return left.toLocaleLowerCase().indexOf(right.toLocaleLowerCase()) >= 0;
		}
		return false;
	}

	private async has(context: Context, right: string): Promise<boolean> {
		let left = await context.getFirstVariableRaw(this.condition.left);
		if(typeof(left) === 'object' && left !== null) {
			if(Array.isArray(left)) {
				let rightNum = parseInt(right);
				if(!isNaN(rightNum) && rightNum < left.length) {
					return true;
				}
			} else {
				return Object.keys(left).indexOf(right) >= 0;
			}
			return false;
		} else if(typeof(left) === 'string') {
			return left.toLocaleLowerCase().indexOf(right.toLocaleLowerCase()) >= 0;
		}
		return false;
	}

	private async is(context: Context): Promise<boolean> {
		let left = await context.getFirstVariableRaw(this.condition.left);
		if(left === null) return false;

		if(typeof(left) === 'boolean') {
			return left;
		} else if(typeof(left) === 'number') {
			return left !== 0;
		} else if(typeof(left) === 'string') {
			if(left.toLowerCase() === 'false') return false;
			if(left === '0') return false;
			return left.length > 0;
		}

		return true;
	}

	private async exists(context: Context): Promise<boolean> {
		let left = await context.getFirstVariableRaw(this.condition.left);
		if(left === null) return false;
		return true;
	}

	serialize(): ICondition {
		return this.condition;
	}

	readable(): string {
		return this.condition.left + ' ' + readableCompare[this.condition.compare] + (this.condition.right.length > 0 ? ' ' + this.condition.right : '');
	}

	async debug(context: Context): Promise<{ left: string, compare: string, right: string }> {
		return { left: await context.interpolate(this.condition.left), compare: this.condition.compare, right: await context.interpolate(this.condition.right) };
	}

	toString(): string {
		return JSON.stringify(this.serialize());
	}

}
export default Conditional;