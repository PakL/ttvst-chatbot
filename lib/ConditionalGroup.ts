import Conditional, { ICondition } from "./Conditional";
import Context from './Context/Context';

export enum IOperator {
	AND = 'and',
	OR = 'or',
	XOR = 'xor'
}

export interface IConditionGroup {
	discriminator: 'ConditionGroup',
	conditions: Array<ICondition|IConditionGroup>,
	operator: IOperator
}

class ConditionalGroup {

	discriminator = 'ConditionGroup';

	conditions: Array<Conditional|ConditionalGroup>;
	operator: IOperator;

	constructor(group: IConditionGroup) {
		this.conditions = [];
		for(let i = 0; i < group.conditions.length; i++) {
			if(group.conditions[i].discriminator == 'Condition') {
				this.conditions.push(new Conditional(group.conditions[i] as ICondition));
			} else if(group.conditions[i].discriminator == 'ConditionGroup') {
				this.conditions.push(new ConditionalGroup(group.conditions[i] as IConditionGroup));
			}
		}
		this.operator = group.operator;
	}

	async meets(context: Context): Promise<boolean> {
		if(this.conditions.length == 0) return true;

		if(this.operator == IOperator.AND) {
			for(let i = 0; i < this.conditions.length; i++) {
				if(!await this.conditions[i].meets(context)) {
					return false;
				}
			}

			return true;
		} else if(this.operator == IOperator.OR) {
			for(let i = 0; i < this.conditions.length; i++) {
				if(await this.conditions[i].meets(context)) {
					return true;
				}
			}
			return false;
		} else if(this.operator == IOperator.XOR) {
			let isSolved = false;
			for(let i = 0; i < this.conditions.length; i++) {
				let solved = await this.conditions[i].meets(context);
				if(solved && isSolved) {
					return false;
				} else if(solved && !isSolved) {
					isSolved = true;
				}
			}
			return isSolved;
		}


		return false;
	}

	add(condition: Conditional|ConditionalGroup) {
		this.conditions.push(condition);
	}

	serialize(): IConditionGroup {
		let conditions: Array<ICondition|IConditionGroup> = [];
		for(let i = 0; i < this.conditions.length; i++) {
			conditions.push(this.conditions[i].serialize());
		}
		return { discriminator: 'ConditionGroup', conditions, operator: this.operator };
	}

	toString(): string {
		return JSON.stringify(this.serialize());
	}

}

export default ConditionalGroup;