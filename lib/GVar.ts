import IDBOrm from './IDBOrm';
import DBHelper from './DBHelper';
import VarInterface from './Context/VarInterface';

export interface IGVar {
	name: string,
	value: string|number|boolean|Array<string|number>|{[key: string]: string|number}
}

class GVarContext extends VarInterface {

	gvar: GVar;

	constructor(gvar: GVar) {
		super(gvar.name, gvar.value);
		this.gvar = gvar;
	}

	async setTo(value: any, index?: string|number): Promise<void> {
		await super.setTo(value, index);
		this.gvar.value = this.value;
		await this.gvar.save();	
	}

}

class GVar extends IDBOrm {

	static store: string = 'globals';
	static keyPath: string = 'name';

	static factory(data: IGVar): GVar {
		return new GVar(data);
	}

	static onOpenRequestUpgradeneeded(event: IDBVersionChangeEvent) {
		if(event.oldVersion == 0) {
			let db = (event.target as IDBOpenDBRequest).result

			db.createObjectStore(GVar.store, { autoIncrement: false, keyPath: GVar.keyPath });
		} else {

			switch(event.oldVersion) {
				// for future database altering
			}

		}
	}

	static get(query: string | IDBArrayKey | IDBKeyRange): Promise<GVar> {
		return (super.get(query) as Promise<GVar>);
	}

	static getAll(query: string | IDBArrayKey | IDBKeyRange): Promise<GVar[]> {
		return (super.getAll(query) as Promise<GVar[]>);
	}

	static getByIndex(index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange): Promise<GVar[]> {
		return (super.getByIndex(index, query) as Promise<GVar[]>);
	}

	get name(): string {
		return this.data.name;
	}

	get value(): IGVar['value'] {
		return this.data.value;
	}

	set value(newvalue: IGVar['value']) {
		this.data.value = newvalue;
	}

	get type(): 'string'|'number'|'boolean'|'assoc'|'list'|'error' {
		if(typeof(this.value) === 'string') return 'string';
		if(typeof(this.value) === 'number') return 'number';
		if(typeof(this.value) === 'boolean') return 'boolean';
		if(typeof(this.value) === 'object' && this.value !== null) {
			if(Array.isArray(this.value)) return 'list';
			else return 'assoc';
		}
		return 'error';
	}

	get datapreview(): string {
		if(this.type === 'string') return ((this.value as string).length > 128 ? (this.value as string).substr(0, 127) + '…' : (this.value as string));
		if(this.type === 'number') return this.value.toString();
		if(this.type === 'boolean') return (this.value ? 'True' : 'False');
		if(this.type === 'list') {
			let liststr = (this.value as Array<string|number>).join(', ');
			return (liststr.length > 128 ? liststr.substr(0, 127) + '…' : liststr);
		}
		if(this.type === 'assoc') {
			let assoclist = [];
			for(let key of Object.keys(this.value)) {
				assoclist.push(key + ': ' + JSON.parse((this.value as {[key: string]: string})[key]));
			}
			let assocstr = assoclist.join(', ');
			return (assocstr.length > 128 ? assocstr.substr(0, 127) + '…' : assocstr);
		}

		return '';
	}

	asContextVar(): GVarContext {
		return new GVarContext(this);
	}

}


DBHelper.addORMObject(GVar);
export default GVar;