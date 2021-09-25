import IDBOrm from './IDBOrm';
import DBHelper from './DBHelper';
import Folder from './Folder';
import ConditionalGroup, { IConditionGroup, IOperator } from './ConditionalGroup';
import { IFlowMath } from './Flow/FlowMath';
import { IFlowAction } from './Flow/FlowAction';
import { IFlowVariable } from './Flow/FlowVariable';
import FlowConditional, { IFlowConditional } from './Flow/FlowConditional';
import { IFlowWait } from './Flow/FlowWait';
import { IFlowWebRequest } from './Flow/FlowWebRequest';
import Context from './Context/Context';

export interface IFlowData {
	key?: number;
	name: string;
	path: string;
	superior: number;
	active: boolean;
	lastModified: Date;
	trigger: string;
	conditionals: string;
	flow: string;
	mode?: { mode: number, props: { [key: string]: string } };
}

class Flow extends IDBOrm {

	static store: string = 'flow';
	static keyPath: string = 'key';

	static factory(data: IFlowData): Flow {
		return new Flow(data);
	}

	static onOpenRequestUpgradeneeded(event: IDBVersionChangeEvent) {
		if(event.oldVersion == 0) {
			let db = (event.target as IDBOpenDBRequest).result

			let flowStore = db.createObjectStore(Flow.store, { autoIncrement: true, keyPath: Flow.keyPath });
			flowStore.createIndex('path', 'path', { unique: false });
			flowStore.createIndex('superior', 'superior', { unique: false });
			flowStore.createIndex('trigger', 'trigger', { unique: false });
		} else {

			switch(event.oldVersion) {
				// for future database altering
			}

		}
	}

	static get(query: number | IDBKeyRange): Promise<Flow> {
		return (super.get(query) as Promise<Flow>);
	}

	static getAll(query: number | IDBKeyRange): Promise<Flow[]> {
		return (super.getAll(query) as Promise<Flow[]>);
	}

	static getByIndex(index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBKeyRange): Promise<Flow[]> {
		return (super.getByIndex(index, query) as Promise<Flow[]>);
	}

	
	save(): Promise<this> {
		this.lastModified = new Date();
		return super.save();
	}

	data: IFlowData;

	constructor(data: IFlowData) {
		super(data);
	}

	get key(): number {
		return typeof(this.data.key) === 'number' ? this.data.key : 0;
	}

	get name(): string {
		return this.data.name;
	}

	set name(newname: string) {
		this.data.name = newname;
	}

	get superior(): number {
		return this.data.superior;
	}

	get path(): string {
		return this.data.path;
	}

	get active(): boolean {
		return this.data.active;
	}

	set active(newactive: boolean) {
		this.data.active = newactive;
		super.save();
	}

	get lastModified(): Date {
		return this.data.lastModified;
	}

	set lastModified(newdate: Date) {
		this.data.lastModified = newdate;
	}

	get trigger(): string {
		return this.data.trigger;
	}

	set trigger(newtrigger: string) {
		this.data.trigger = newtrigger;
	}

	get mode(): { mode: number, props: { [key: string]: string } } {
		if(typeof(this.data.mode) === 'undefined') {
			return { mode: 2, props: {} };
		}
		return this.data.mode;
	}

	set mode(newmode: { mode: number, props: { [key: string]: string } }) {
		this.data.mode = newmode;
	}

	get conditionals(): ConditionalGroup {
		let j: IConditionGroup = JSON.parse(this.data.conditionals);
		if(j === null || typeof(j) !== 'object' || Array.isArray(j)) {
			j = {discriminator:'ConditionGroup', conditions:[], operator: IOperator.AND };
		}
		return new ConditionalGroup(j);
	}

	set conditionals(newconditionals: ConditionalGroup) {
		this.data.conditionals = newconditionals.toString();
	}

	get flow(): Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest> {
		let j: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest> = [];
		try {
			j = JSON.parse(this.data.flow);
			if(typeof(j) !== 'object' || !Array.isArray(j)) {
				j = [];
			}
		} catch(e) {}
		return j;
	}

	set flow(newflow: Array<IFlowVariable|IFlowAction|IFlowMath|IFlowConditional|IFlowWait|IFlowWebRequest>) {
		this.data.flow = JSON.stringify(newflow);
	}

	async execute(context: Context) {
		await FlowConditional.execFlow(this.flow, context);
	}

	async getAbsolutePath(): Promise<Folder[]> {
		await this.correctPath();

		let supIds = this.path.split('/');
		let path: Folder[] = [];

		for(let i = 0; i < supIds.length; i++) {
			if(supIds[i].length <= 0) continue;
			let key = parseInt(supIds[i]);
			path.push(await Folder.get(key));
		}
		
		return path;
	}

	async correctPath(): Promise<void> {
		try {
			let suppath = '';
			if(this.superior > -1) {
				let folder = await Folder.get(this.superior);
				suppath = folder.path + folder.key.toString()
			}
			if(this.path !== (suppath + '/')) {
				this.data.path = (suppath + '/');
				await super.save();
			}
		} catch(e) {}
	}

}

DBHelper.addORMObject(Flow);
export default Flow;