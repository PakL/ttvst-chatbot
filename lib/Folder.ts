import IDBOrm from './IDBOrm';
import DBHelper from './DBHelper';
import ConditionalGroup, { IConditionGroup, IOperator } from './ConditionalGroup';

export interface IFolderData {
	key?: number;
	name: string;
	path: string;
	superior: number;
	conditionals: string;
	active: boolean;
	lastModified: Date;
}

class Folder extends IDBOrm {

	static store: string = 'folders';
	static keyPath: string = 'key';

	static factory(data: IFolderData): Folder {
		return new Folder(data);
	}

	static onOpenRequestUpgradeneeded(event: IDBVersionChangeEvent) {
		if(event.oldVersion == 0) {
			let db = (event.target as IDBOpenDBRequest).result

			let folderStore = db.createObjectStore(Folder.store, { autoIncrement: true, keyPath: Folder.keyPath });
			folderStore.createIndex('path', 'path', { unique: false });
			folderStore.createIndex('superior', 'superior', { unique: false });
		} else {

			switch(event.oldVersion) {
				// for future database altering
			}

		}
	}

	static get(query: number | IDBArrayKey | IDBKeyRange): Promise<Folder> {
		return (super.get(query) as Promise<Folder>);
	}

	static getAll(query: number | IDBArrayKey | IDBKeyRange): Promise<Folder[]> {
		return (super.getAll(query) as Promise<Folder[]>);
	}

	static getByIndex(index: string, query: string | number | Date | ArrayBufferView | ArrayBuffer | IDBArrayKey | IDBKeyRange): Promise<Folder[]> {
		return (super.getByIndex(index, query) as Promise<Folder[]>);
	}

	
	save(): Promise<this> {
		this.lastModified = new Date();
		return super.save();
	}

	data: IFolderData;

	constructor(data: IFolderData) {
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

	async getAbsolutePath(): Promise<Folder[]> {
		await this.correctPath();

		let supIds = this.path.split('/');
		let path: Folder[] = [];

		for(let i = 0; i < supIds.length; i++) {
			if(supIds[i].length <= 0) continue;
			let key = parseInt(supIds[i]);
			path.push(await Folder.get(key));
		}
		path.push(this);
		
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

DBHelper.addORMObject(Folder);
export default Folder;