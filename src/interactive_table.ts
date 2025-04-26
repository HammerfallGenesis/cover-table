import { App, TFile } from "obsidian";

export class InteractiveTable {
	private dv: any;
	constructor(private app: App) {}
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [0] 상수 & 정규 표현식, 새로고침 함수

	   - dateYMDRegex, timeHMRegex 같은 파싱에 필요한 패턴 선언
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
	private readonly timeHMRegex = /^(\d{1,2}):(\d{1,2})$/;
	/* --------------------------------------------------------------------
	   [0-1] 새로고침 함수수
	-------------------------------------------------------------------- */
	private refreshCommand(delay = 50) {
		setTimeout(() => {
		  this.app.commands.executeCommandById("dataview:dataview-force-refresh-views");
		}, delay);
	  }
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [1] 상태 관리 (State Management)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	private resolveViewId(settings: any): string {
		let id = settings["id"];
		if (!id || typeof id !== "string") {
			id = "auto-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6);
		}
		return id;
	}
	/* --------------------------------------------------------------------
	   [1-1] 로컬 스토리지 접근
	-------------------------------------------------------------------- */
	// [1-1-1] 로컬 스토리지 저장‧검색 시 사용할 고유 키 생성 함수
	private getStorageKey(notePath: string, viewId: string): string {
		return `coverTable::${notePath}::${viewId}`;
	}
	// [1-1-2] 로컬 스토리지에서 가져오기 함수 / 저장하기 함수
	private _getLocalState(notePath: string, viewId: string) {
		const key = this.getStorageKey(notePath, viewId);
		const dataString = localStorage.getItem(key);
		if (!dataString) return {};
		try {
			return JSON.parse(dataString);
		} catch {
			return {};
		}
	}
	private _setLocalState(notePath: string, viewId: string, obj: any) {
		const key = this.getStorageKey(notePath, viewId);
		localStorage.setItem(key, JSON.stringify(obj));
	}
	// [1-1-3] 특정 속성(propName) 값 가져오기 함수 / 값 저장하기 함수
	private _getState(notePath: string, viewId: string, propName: string) {
		const localData = this._getLocalState(notePath, viewId);
		return localData.hasOwnProperty(propName) ? localData[propName] : null;
	}
	private _setState(notePath: string, viewId: string, propName: string, val: any) {
		const localData = this._getLocalState(notePath, viewId);
		localData[propName] = val;
		this._setLocalState(notePath, viewId, localData);
	}
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [2] 데이터 파싱 & 포맷팅 (Data Utilities)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [2-1] 프론트매터 항목 값 추출 함수
	-------------------------------------------------------------------- */
	private getVal(page: any, prop: string) {
		if (!page) return null;
		if (prop.startsWith("file.")) {
			const parts = prop.split(".");
			let v: any = page;
			for (let i = 0; i < parts.length; i++) {
				if (v && v[parts[i]] !== undefined) {
					v = v[parts[i]];
				} else {
					return null;
				}
			}
			return v;
		}
		return page[prop];
	}
	/* --------------------------------------------------------------------
	   [2-2] 날짜/시간 파싱싱
	-------------------------------------------------------------------- */
	private parseDateYMD(str: string) {
		if (typeof str !== "string") return null;
		const m = str.match(this.dateYMDRegex);
		if (m) {
			const y = parseInt(m[1], 10);
			const mo = parseInt(m[2], 10);
			const d = parseInt(m[3], 10);
			if (y < 1000 || y > 9999 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
			return new Date(y, mo - 1, d);
		}
		const dt = new Date(str);
		return isNaN(dt.getTime()) ? null : dt;
	}
	private parseTimeHM(str: string) {
		if (typeof str !== "string") return null;
		const m = str.match(this.timeHMRegex);
		if (!m) return null;
		const hh = parseInt(m[1], 10);
		const mm = parseInt(m[2], 10);
		if (hh > 23 || mm > 59) return null;
		const dt = new Date();
		dt.setHours(hh);
		dt.setMinutes(mm);
		return dt;
	}
	/* --------------------------------------------------------------------
	   [2-3] 정렬용 키 생성 (전처리)
	-------------------------------------------------------------------- */
	private getSortValue(value: any, _prop: string) {
		if (value === undefined || value === null) return "";
		const s = typeof value === "string" ? value : String(value);
		let dt = this.parseDateYMD(s);
		if (!dt) {
			const dt2 = this.parseTimeHM(s);
			if (dt2) dt = dt2;
		}
		if (dt) return dt.getTime();
		const num = parseFloat(s);
		return !isNaN(num) ? num : s.toLowerCase();
	}
	/* --------------------------------------------------------------------
	   [2-4] 날짜 포맷
	-------------------------------------------------------------------- */
	private formatAsYYYYMMDDIfDate(value: any): string {
		if (value === undefined || value === null) return "";
		const s = typeof value === "string" ? value : String(value);
		const dt = this.parseDateYMD(s);
		if (!dt) return s;
		const yy = dt.getFullYear();
		const mm = dt.getMonth() + 1;
		const dd = dt.getDate();
		const mmStr = mm < 10 ? "0" + mm : "" + mm;
		const ddStr = dd < 10 ? "0" + dd : "" + dd;
		return `${yy}-${mmStr}-${ddStr}`;
	}

	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [3] 속성 재배치 & 정렬 (Columns Utilities)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [3-1] title/tags 고정
	-------------------------------------------------------------------- */
	private reorderProps(original: any[]) {
		// prop === 'title' 컬럼 추출
		const titleCol = original.find(p => p.prop === 'title');
		// prop === 'tags'  컬럼 추출
		const tagCol   = original.find(p => p.prop === 'tags');
		// 나머지 컬럼들
		const middle   = original.filter(p => p.prop !== 'title' && p.prop !== 'tags');

		// title → middle → tags 순으로 새 배열 반환
		return [
			...(titleCol ? [titleCol] : []),
			...middle,
			...(tagCol ? [tagCol] : [])
		];
	}
	/* --------------------------------------------------------------------
	   [3-2] 정렬 (title_link은 별도 정렬하지 않음)
	-------------------------------------------------------------------- */
	private sortByProp(pages: any[], prop: string | null, dir: string) {
		if (!prop || prop === "title_link") return pages;
		dir = dir || "asc";
		return pages.sort((a, b) => {
			const A = this.getVal(a, prop);
			const B = this.getVal(b, prop);
			const sA = this.getSortValue(A, prop);
			const sB = this.getSortValue(B, prop);
			if (typeof sA === "number" && typeof sB === "number") {
				return dir === "asc" ? sA - sB : sB - sA;
			}
			const strA = String(sA);
			const strB = String(sB);
			return dir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
		});
	}
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [4] 필터링 & 검색 (Filtering & Search)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [4-1] frontmatter 필터
	-------------------------------------------------------------------- */
	private async makeFilterButton(p: any, pages: any[], notePath: string, viewId: string) {
		const btn = document.createElement("button");
		btn.className = "interactive_table-filter__btn";
		const nm = p.name || p.prop;
		btn.append(nm);
		btn.onclick = async () => {
			await this.changePropFilter(p, pages, notePath, viewId);
		};
		return btn;
	}
	private async changePropFilter(p: any, pages: any[], notePath: string, viewId: string) {
		const setOfVals = new Set<string>();
		for (const pg of pages) {
			let rawVal = this.getVal(pg, p.prop);
			let val = this.formatAsYYYYMMDDIfDate(rawVal);
			if (!val) val = "-";
			setOfVals.add(val);
		}
		let arrOfVals = Array.from(setOfVals);
		const hasDash = arrOfVals.includes("-");
		if (hasDash) {
			arrOfVals = arrOfVals.filter(v => v !== "-");
		}
		arrOfVals.sort((a, b) => a.localeCompare(b));
		const uv = hasDash ? ["ALL", "-"].concat(arrOfVals) : ["ALL", ...arrOfVals];
		const chosen = await this.suggester(uv);
		if (!chosen) return;
		const fKey = `filter_${viewId}_${p.prop}`;
		this._setState(notePath, viewId, fKey, chosen);
		this.refreshCommand(50);
	}
	private async filterByProp(p: any, pages: any[], notePath: string, viewId: string) {
		const fKey = `filter_${viewId}_${p.prop}`;
		const val = this._getState(notePath, viewId, fKey);
		if (!val || val === "ALL") return pages;
		return pages.filter((pg) => {
			let rawV = this.getVal(pg, p.prop);
			let cmpV = this.formatAsYYYYMMDDIfDate(rawV);
			if (!cmpV) cmpV = "-";
			return cmpV === val;
		});
	}
	/* --------------------------------------------------------------------
	   [4-2] tag 필터
	-------------------------------------------------------------------- */
	private async renderTagFilterButton(pages: any[], container: HTMLElement, notePath: string, viewId: string) {
		try {
			const currentTag = this._getState(notePath, viewId, "tagFilter") || "ALL";
			const btn = document.createElement("button");
			btn.className = "interactive_table-button interactive_table-button--tag-filter";
			btn.textContent = currentTag;
			btn.onclick = async () => {
				try {
					const allTags = new Set<string>();
					pages.forEach((pg) => {
						const tg = pg?.file?.tags || pg?.tags;
						if (!tg) return;
						if (Array.isArray(tg)) tg.forEach((xx) => allTags.add(xx));
					});
					const arr = ["ALL", ...Array.from(allTags).sort()];
					const chosen = await this.suggester(arr);
					if (!chosen) return;
					this._setState(notePath, viewId, "tagFilter", chosen);
					this.refreshCommand(50);
				} catch {}
			};
			container.appendChild(btn);
		} catch {}
	}
	private async applyTagFilter(pages: any[], notePath: string, viewId: string) {
		const tg = this._getState(notePath, viewId, "tagFilter") || "ALL";
		if (tg === "ALL") return pages;
		return pages.filter((pg) => {
			const arr = pg?.file?.tags || pg?.tags;
			return Array.isArray(arr) && arr.includes(tg);
		});
	}
	/* --------------------------------------------------------------------
	   [4-3] 전체 검색
	-------------------------------------------------------------------- */
	// 검색 텍스트 데이터셋 구축
	private buildSearchTextMap(props: any[], pages: any[]) {
		const tableProps = props.filter((c) => c.column);
		pages.forEach((pg) => {
			const buf: string[] = [];
			tableProps.forEach((col) => {
				let tv: string;
				if (col.prop === "title_link") {
					const aliasPart = pg.__fmTitle || "";
					tv = aliasPart;
				} else if (col.prop === "table") {
					tv = pg.__fmTable || "";
				} else {
					const rawVal = this.getVal(pg, col.prop);
					tv = rawVal == null ? "" : String(rawVal);
				}
				buf.push(tv.toLowerCase());
			});
			pg.__searchText = buf.join(" ");
		});
	}
	// 검색 로직 (Frontmatter -> tags -> text)
	private async filterProps(props: any[], pages: any[], notePath: string, viewId: string) {
		for (const p of props.filter((x) => x.filter)) {
			pages = await this.filterByProp(p, pages, notePath, viewId);
		}
		pages = await this.applyTagFilter(pages, notePath, viewId);
		const sr = this._getState(notePath, viewId, `search_ready_${viewId}`);
		if (sr) {
			let sVal = (this._getState(notePath, viewId, `search_${viewId}`) || "").trim();
			if (sVal.length > 0) {
				const ws = sVal.split(" ");
				this.buildSearchTextMap(props, pages);
				for (let w of ws) {
					w = w.trim().toLowerCase();
					if (w.length > 0) {
						pages = pages.filter((pg) => {
							const txt = pg.__searchText || "";
							return txt.includes(w);
						});
					}
				}
			}
		}
		return pages;
	}
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [5] 페이지네이션 (Pagination)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [5-1] 배열에서 “현재 페이지”에 해당하는 데이터만 잘라 반환
	-------------------------------------------------------------------- */
	private paginate(arr: any[], per: number, notePath: string, viewId: string) {
		const key = `pagination_${viewId}`;
		const totalPages = per > 0 ? Math.ceil(arr.length / per) : 1;
		let pageIdx = this._getState(notePath, viewId, key) || 0;
	
		if (pageIdx >= totalPages) {
		  pageIdx = totalPages - 1;
		  this._setState(notePath, viewId, key, pageIdx);
		}
	
		return per > 0
		  ? arr.slice(pageIdx * per, (pageIdx + 1) * per)
		  : [...arr];
	}
	/* --------------------------------------------------------------------
	   [5-2] 페이지 번호/이동 버튼이 들어갈 “pagination block” UI를 생성
	-------------------------------------------------------------------- */
	private async paginationBlock(data: any[], per: number, container: HTMLElement, notePath: string, viewId: string) {
		const key = `pagination_${viewId}`;
		const totalPages = Math.ceil(data.length / per);
		const wrap = document.createElement("div");
		wrap.className = "interactive_table-pagination";

		const prv = await this.prevPageButton(totalPages, key, notePath, viewId);
		wrap.appendChild(prv);

		const curS = document.createElement("span");
		const cv = (this._getState(notePath, viewId, key) || 0) + 1;
		curS.textContent = `${cv} / ${totalPages}`;
		wrap.appendChild(curS);

		const nxt = await this.nextPageButton(totalPages, key, notePath, viewId);
		wrap.appendChild(nxt);

		container.appendChild(wrap);
	}
	/* --------------------------------------------------------------------
	   [5-3] “다음 페이지” / “이전 페이지” 버튼 생성
	-------------------------------------------------------------------- */
	private async nextPageButton(totalPages: number, storeKey: string, notePath: string, viewId: string) {
		const cv = this._getState(notePath, viewId, storeKey) || 0;
		const canNext = cv + 1 < totalPages;
		const base = "interactive_table-pagination__btn";
		const bClass = canNext ? base: `${base} ${base}--disabled`;

		const btn = document.createElement("button");
		btn.className = bClass;
		btn.append(">>");
		btn.onclick = async () => {
			if (!canNext) return;
			this._setState(notePath, viewId, storeKey, cv + 1);
			const el=document.querySelector(`.interactive_table-view--${viewId}`);
			if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
			this.refreshCommand(60);
		};
		return btn;
	}
	private async prevPageButton(totalPages: number, storeKey: string, notePath: string, viewId: string) {
		const cv = this._getState(notePath, viewId, storeKey) || 0;
		const canPrev = cv > 0;
		const base = "interactive_table-pagination__btn";
		const bClass = canPrev ? base: `${base} ${base}--disabled`;

		const btn = document.createElement("button");
		btn.className = bClass;
		btn.append("<<");
		btn.onclick = async () => {
			if (!canPrev) return;
			this._setState(notePath, viewId, storeKey, cv - 1);
			const el=document.querySelector(`.interactive_table-view--${viewId}`);
			if(el) el.scrollIntoView({behavior:"smooth",block:"start"});
			this.refreshCommand(60);
		};
		return btn;
	}
	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [6] UI 컴포넌트 생성 (UI Elements)
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [6-1] 버튼 계열
	-------------------------------------------------------------------- */
	// [6-1-1] Open Folder 버튼(파일탐색기)
	async viewFolderButton(relPath: string, container: HTMLElement) {
		const btn = document.createElement("button");
		btn.className = "interactive_table-button interactive_table-button--open-folder";
		btn.append("↪ Open Folder");
		btn.onclick = async () => {
			try {
				const { shell } = (window as any).require("electron");
				const pathMod = (window as any).require("path");
				if (!shell) {
					new (globalThis as any).coverTable.obsidian.Notice("Electron shell is undefined!");
					return;
				}
				const vaultBase = (this.app.vault.adapter as any).basePath;
				const absolutePath = pathMod.resolve(vaultBase, relPath);
				const isFile = pathMod.extname(absolutePath) !== "";
				if (isFile) {
					shell.showItemInFolder(absolutePath);
				} else {
					shell.openPath(absolutePath);
				}
			} catch (e: any) {
				new (globalThis as any).coverTable.obsidian.Notice(`Error:\n${e.message}`);
			}
		};
		container.append(btn);
	}
	// [6-1-2] New note 버튼
	private async newNoteButton(dv: any, container: HTMLElement) {
		const btn = document.createElement("button");
		btn.className = "interactive_table-button interactive_table-button--new-note";
		btn.append("+ New note");
		btn.onclick = async () => {
			try {
				const curFile =dv.current?.()?.file;
				const targetDir = this.app.fileManager.getNewFileParent(curFile?.path ?? "");
				const newFile = await this.app.fileManager.createNewMarkdownFile(targetDir, "Untitled");
				await this.app.workspace.getLeaf(true).openFile(newFile);
				new (globalThis as any).coverTable.obsidian.Notice(`Note created: ${newFile.path}`);
			} catch (e: any) {
				new (globalThis as any).coverTable.obsidian.Notice(`Error:\n${e.message}`);
			}
		};
		container.append(btn);
	}
	// [6-1-3] Refresh 버튼
	async refreshButton(container: HTMLElement, notePath: string, viewId: string) {
		const btn = document.createElement("button");
		btn.className = "interactive_table-button interactive_table-button--refresh";
		btn.style.marginRight = "8px";
		btn.append("↺");
		btn.onclick = async () => {
			this._setState(notePath, viewId, `sort_${viewId}`, null);
			this._setState(notePath, viewId, `sort_direction_${viewId}`, "asc");
			this.refreshCommand(50);
		};
		container.append(btn);
	}
	// [6-1-4] 검색창, 검색버튼 구축
	private async searchInput(container: HTMLElement, notePath: string, viewId: string) {
		// ────────────────── 래퍼 div 만들기 ──────────────────
		const wrap = document.createElement("div");
		wrap.className = "interactive_table-search";
		wrap.style.display = "flex";
		wrap.style.alignItems = "center";
		// ────────────────── 이전 검색 상태 로드 ──────────────────
		const sKey = `search_${viewId}`;
		const sVal = this._getState(notePath, viewId, sKey) || "";
		const wasFocused = this._getState(notePath, viewId, `search_focus_${viewId}`) === true;
		// ────────────────── 입력창 생성 ──────────────────
		const input = document.createElement("input");
		input.className = "interactive_table-search__input";
		input.value = sVal;
		input.placeholder = "검색...";
		input.style.marginRight = "8px";

		if (wasFocused) {
			setTimeout(() => input.focus(), 0);
		}
		input.addEventListener("focus", () => {
			this._setState(notePath, viewId, `search_focus_${viewId}`, true);
		});
		input.addEventListener("blur", () => {
			this._setState(notePath, viewId, `search_focus_${viewId}`, false);
		});
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				this._setState(notePath, viewId, sKey, input.value);
				this._setState(notePath, viewId, `search_ready_${viewId}`, true);
				this.refreshCommand(80);
			}
		});
		wrap.appendChild(input);
		// ────────────────── 검색 버튼 생성 ──────────────────
		const btn = document.createElement("button");
		btn.className = "interactive_table-search__btn";
		btn.innerText = "⌕";
		btn.onclick = async () => {
			this._setState(notePath, viewId, sKey, input.value);
			this._setState(notePath, viewId, `search_ready_${viewId}`, true);
			this.refreshCommand(80);
			setTimeout(() => input.focus(), 80);
		};
		wrap.appendChild(btn);
		// ────────────────── 최종 삽입 ──────────────────
		container.appendChild(wrap);
	}
	// [6-1-5] 필터 버튼 렌더러 (Filter Button Props)
	private async filterButtonProps(props: any[], pages: any[], container: HTMLElement, notePath: string, viewId: string) {
		const flt = props.filter((pp) => pp.filter);
		if (flt.length === 0) return;
		const wrap = document.createElement("div");
		wrap.className = "interactive_table-filter__buttons";
		for (const p of flt) {
			const b = await this.makeFilterButton(p, pages, notePath, viewId);
			wrap.appendChild(b);
		}
		container.appendChild(wrap);
	}
	/* --------------------------------------------------------------------
	   [6-2] 인라인 편집 핸들러 (Inline Editing)
	-------------------------------------------------------------------- */
	private async editProp(type: string, path: string, prop: string) {
		const file = app.vault.getAbstractFileByPath(path);
		if (!file) return;
		if (type === "file name" && file instanceof TFile) {
			const oldName = file.basename;
			const newName = await this.textInput(oldName);
			if (!newName) return;
			const folder = file.parent?.path || "";
			const ext = file.extension;
			const newPath = folder ? `${folder}/${newName}.${ext}` : `${newName}.${ext}`;
			await this.app.vault.rename(file, newPath);
			this.refreshCommand(50);
			return;
		}
		this.refreshCommand(50);
	}
	/* --------------------------------------------------------------------
	   [6-3] 모달 헬퍼 (Modal Utilities)
	-------------------------------------------------------------------- */
	private async textInput(defaultVal: string) {
		return new Promise<string | null>((resolve) => {
			const { Modal } = (globalThis as any).coverTable.obsidian;
			class MyModal extends Modal {
				result: string;
				constructor(app: App) {
					super(app);
					this.result = defaultVal;
				}
				onOpen() {
					const { contentEl } = this;
					contentEl.createEl("h1", { text: "Input" });
					const inp = contentEl.createEl("input");
					inp.value = this.result;
					inp.style.width = "100%";
					inp.addEventListener("keydown", (ev) => {
						if (ev.key === "Enter") {
							this.result = inp.value.trim();
							this.close();
							resolve(this.result);
						}
					});
					const okBtn = contentEl.createEl("button", { text: "OK" });
					okBtn.onclick = () => {
						this.result = inp.value.trim();
						this.close();
						resolve(this.result);
					};
				}
				onClose() {
					this.contentEl.empty();
				}
			}
			new MyModal(app).open();
		});
	}
	private async suggester(vals: string[]) {
		const { SuggestModal } = (globalThis as any).coverTable.obsidian;
		return new Promise<string | null>((resolve) => {
			class MySugg extends SuggestModal<string> {
				getSuggestions(q: string): string[] {
					return vals.filter((x) => x.toLowerCase().includes(q.toLowerCase()));
				}
				renderSuggestion(val: string, el: HTMLElement) {
					el.createEl("div", { text: val });
				}
				onChooseSuggestion(val: string) {
					resolve(val);
				}
			}
			new MySugg(app).open();
		}).catch(() => null);
	}
	/* --------------------------------------------------------------------
	   [6-4] 테이블 생성 (헤더 생성 → 행 생성 → 이벤트 바인딩)
	-------------------------------------------------------------------- */
	private async createTable(props: any[], pages: any[], container: HTMLElement, notePath: string, viewId: string, entriesPerPage: number, settings: any) {
		// ───────── 1) 프론트매터 title 준비 & 열 재정렬 ─────────
		props = this.reorderProps(props);        // title·tags 고정 위치
		pages.forEach(pg => {
			try {
				// Dataview API로 frontmatter.title 가져오기(가능할 때)
				const dvPage = this.dv?.page(pg.file.path);
				pg.__fmTitle = dvPage?.frontmatter?.title || dvPage?.title || "";
			} catch {
				// Dataview 실패 ⇒ 원본 frontmatter로 대체
				pg.__fmTitle = pg.frontmatter?.title || "";
			}
		});

		// ───────── 2) 속성·태그·검색 필터 적용 ─────────
		let filtered = await this.filterProps(props, pages, notePath, viewId);

		// ───────── 3) 정렬 처리 ─────────
		const sKey = `sort_${viewId}`;                  // 정렬 대상 prop
		const dKey = `sort_direction_${viewId}`;        // asc/desc
		let curSort = this._getState(notePath, viewId, sKey);
		let curDir  = this._getState(notePath, viewId, dKey) || "asc";

		if (!curSort) {
			// 기본: 프론트매터 title(알파벳순)
			filtered.sort((a, b) => a.__fmTitle.localeCompare(b.__fmTitle));
		} else {
			// 사용자 지정 정렬
			filtered = this.sortByProp(filtered, curSort, curDir);
		}

		// ───────── 4) 페이지네이션 적용 ─────────
		const disp = entriesPerPage
			? this.paginate(filtered, entriesPerPage, notePath, viewId)
			: [...filtered];

		// ───────── 5) 테이블 헤더 DOM 생성 ─────────
		const headers: string[] = [];
		props.forEach((col) => {
			const hd = document.createElement("div");
			if (col.prop === "title_link") {
				hd.classList.add("interactive_table-table__header--static");
			} else {
				hd.classList.add("interactive_table-table__header--sortable");
				hd.setAttribute("data-prop", col.prop);
				hd.setAttribute("data-view-id", viewId);
			}
			hd.innerText = col.name || col.prop;
			headers.push(hd.outerHTML);
		});

		// ───────── 6) 테이블 행(row) 생성 ─────────
		const rows = disp.map((pg) => {
			const rowCells: string[] = [];
			for (const col of props) {
				let val = this.getVal(pg, col.prop);
				if (col.prop === "title_link") {
					const alias = pg.__fmTitle || "";
					if (typeof val === "object" && val?.path) {
						const linkMarkup = alias.trim() === ""
							? `[[${val.path}]]`
							: `[[${val.path}|${alias}]]`;
						rowCells.push(`<div class="interactive_table-table__cell--editable" data-path="${pg.file?.path || ""}" data-prop="title_link">${linkMarkup}</div>`);
					} else {
						if (alias.trim() === "") {
							rowCells.push(`<div class="interactive_table-table__cell--editable" data-path="${pg.file?.path || ""}" data-prop="title_link">[[${(val && typeof val === "object" && val?.path) ? val.path : ""}]]</div>`);
						} else {
							rowCells.push(`<div class="interactive_table-table__cell--editable" data-path="${pg.file?.path || ""}" data-prop="title_link">${alias}</div>`);
						}
					}
				} else {
					if (Array.isArray(val)) {
						if (col.prop === "tags") {
							const updated: string[] = [];
							for (const item of val) {
								item.split(/\s+/).forEach((tk) => {
									if (tk && !tk.startsWith("#")) {
										tk = "#" + tk;
									}
									updated.push(tk);
								});
							}
							val = updated.join(" ");
						} else {
							val = val.join(" ");
						}
					}
					if (col.prop === "published") {
						const dt = this.parseDateYMD(val);
						val = dt ? dt.getFullYear().toString() : (val || "-");
					} else {
						val = this.formatAsYYYYMMDDIfDate(val);
						if (!val) val = "-";
					}
					rowCells.push(`<div class="interactive_table-table__cell--editable" data-path="${pg.file?.path || ""}" data-prop="${col.prop}">${val}</div>`);
				}
			}
			return rowCells;
		});

		const mdTable = this.dv.markdownTable(headers, rows);
		const wrapP = this.dv.paragraph(mdTable);
		wrapP.classList.add("interactive_table-table", "interactive_table-table--full");
		container.appendChild(wrapP);

		// ───────── 7) 셀 클릭 ⇒ 인라인 편집 트리거 ─────────
		wrapP.querySelectorAll(".interactive_table-table__cell--editable").forEach((btn) => {
			btn.addEventListener("click", async (e: any) => {
				if (e.target.localName === "a") return;
				const path = btn.getAttribute("data-path");
				const prop = btn.getAttribute("data-prop");
				if (path && prop) await this.editProp("text", path, prop);
			});
		});

		// ───────── 8) 헤더 클릭 ⇒ 정렬 토글 ─────────
		const hdrBtns = wrapP.querySelectorAll(".interactive_table-table__header--sortable");
		const applySortVisual = (sortProp: string | null, sortDir: string) => {
			hdrBtns.forEach((hb: any) => {
				hb.classList.remove("sorted-asc", "sorted-desc", "sorted-none");
			});
			hdrBtns.forEach((hb: any) => {
				const p = hb.getAttribute("data-prop") || "";
				if (!sortProp || sortProp !== p) {
					hb.classList.add("sorted-none");
				} else {
					hb.classList.add(sortDir === "asc" ? "sorted-asc" : "sorted-desc");
				}
			});
		};

		hdrBtns.forEach((hb) => {
			hb.addEventListener("click", async () => {
				let p = hb.getAttribute("data-prop") || "";
				const vId = hb.getAttribute("data-view-id") || "";
				const sKey = `sort_${vId}`;
				const dKey = `sort_direction_${vId}`;
				let curSort = this._getState(notePath, vId, sKey);
				let curDir = this._getState(notePath, vId, dKey) || "asc";

				if (curSort !== p) {
					curSort = p;
					curDir = "asc";
				} else {
					if (curDir === "asc") curDir = "desc";
					else if (curDir === "desc") {
						curSort = null;
						curDir = "asc";
					}
				}
				this._setState(notePath, vId, sKey, curSort);
				this._setState(notePath, vId, dKey, curDir);
				applySortVisual(curSort, curDir);
				this.refreshCommand(50);
			});
		});
		applySortVisual(curSort, curDir);

		return filtered;
	}


	/* --------------------------------------------------------------------
	-----------------------------------------------------------------------
	   [7] 메인 진입점
	-----------------------------------------------------------------------
	-------------------------------------------------------------------- */
	/* --------------------------------------------------------------------
	   [7-1] DataviewJS 엔트리 포인트: renderView
	-------------------------------------------------------------------- */
	public async renderView(settings: any, props: any[], pages: any[], dv: any) {
		const originalConsoleError = console.error;
		console.error = (...args: any[]) => {
			const msg = args[0] instanceof Error ? args[0].message : String(args[0]);
			if (msg.includes("Cannot read properties of undefined (reading 'file')")) {
				return;
			}
			originalConsoleError(...args);
		};

		try {
			if (!dv || !pages || !Array.isArray(pages)) return;
			const curr = dv.current?.();
			if (!curr || !curr.file || !curr.file.path) return;
			const notePath = curr.file.path;
			pages = pages.filter((pg: any) => pg?.file?.path);

			this.dv = dv;
			const id = this.resolveViewId(settings);

			// folding 옵션 처리
			const oldContainer = dv.container;
			if (settings.folding === true) {
				const detailsParent = dv.container.createEl("details");
				const summaryEl = detailsParent.createEl("summary");
				summaryEl.setText(settings.foldingTitle || "Dataview");
				const foldedDiv = detailsParent.createEl("div");
				dv.container = foldedDiv;
			}

			const containerDiv = document.createElement("div");
			containerDiv.classList.add("interactive_table-view", `interactive_table-view--${id}`, "interactive_table-view--fade");
			dv.container.append(containerDiv);

			// 상단 영역 구성
			const topRow = document.createElement("div");
			topRow.classList.add("interactive_table-header");
			topRow.style.display = "flex";
			topRow.style.justifyContent = "space-between";
			topRow.style.alignItems = "center";
			containerDiv.appendChild(topRow);

			const leftArea = document.createElement("div");
			leftArea.className = "interactive_table-header__left";
			const centerArea = document.createElement("div");
			centerArea.className = "interactive_table-header__center";
			const rightArea = document.createElement("div");
			rightArea.className = "interactive_table-header__right";
			topRow.append(leftArea, centerArea, rightArea);

			if (settings.path) {
				await this.viewFolderButton(settings.path, leftArea);
			}

			await this.renderTagFilterButton(pages, leftArea, notePath, id);
			await this.refreshButton(rightArea, notePath, id);
			await this.searchInput(rightArea, notePath, id);
			await this.newNoteButton(dv, rightArea);   

			const fmRow = document.createElement("div");
			fmRow.className = "interactive_table-filter";
			containerDiv.appendChild(fmRow);
			await this.filterButtonProps(props, pages, fmRow, notePath, id);

			const epp = settings["entries on page"] || 10;
			const finalFiltered = await this.createTable(props, pages, containerDiv, notePath, id, epp, settings);
			if (epp) {
				await this.paginationBlock(finalFiltered, epp, containerDiv, notePath, id);
			}

			dv.container = oldContainer;
		} catch (err) {
			console.warn("InteractiveTable renderView suppressed error:", err);
		} finally {
			setTimeout(() => {
				const allErrBlocks = document.querySelectorAll(".dataview-error, .dataview .error, .dv-render-error");
				allErrBlocks.forEach((elem) => {
					if (elem.textContent && elem.textContent.includes("Evaluation Error")) {
						elem.remove();
					}
				});
			}, 100);
			console.error = originalConsoleError;
		}
	}
	/* --------------------------------------------------------------------
	   [7-2] renderAutoView (현재 노트 폴더의 md 문서 및 .canvas 파일 자동 수집)
	-------------------------------------------------------------------- */
	public async renderAutoView(dv: any, settings: any = {}) {
		const currFile = dv.current()?.file;
		if (!currFile) {
			console.warn("renderAutoView: No current file found.");
			return;
		}

		// (1) 현재 노트와 동일 폴더의 md 문서들
		const mdPages = dv.pages()
			.where((p: any) => p.file.folder === currFile.folder)
			.where((p: any) => p.file.path !== currFile.path)
			.array();

		// (2) 동일 폴더 내 .canvas 파일 수집
		const currentFolder = currFile.folder;
		const canvasFiles = this.app.vault.getFiles()
			.filter(f => f.extension === "canvas")
			.filter(f => {
				const parentFolder = f.path.substring(0, f.path.lastIndexOf("/")) || "";
				return parentFolder === currentFolder;
			});

		// (3) .canvas 파일을 dataview 페이지 형식으로 변환 (frontmatter.title, tags 보강)
		const canvasPages = canvasFiles.map(cf => {
			return {
				file: {
					path: cf.path,
					link: dv.fileLink(cf.path),
					folder: currentFolder,
				},
				frontmatter: {
					title: cf.basename,
				},
				created: "",
				status: "",
				tags: "#캔버스"
			};
		});

		// (4) mdPages + canvasPages 결합
		const pages = mdPages.concat(canvasPages);

		// (5) 기본 props 설정 (설정값이 있으면 대체)
		const defaultProps = [
			{ prop: "title_link", name: "Title", filter: false, column: true },
			{ prop: "created",   name: "Created", filter: true, column: true },
			{ prop: "tags",    name: "Tags",  filter: true, column: true },
		];
		const finalProps = settings.props || defaultProps;

		// (6) renderView 호출
		await this.renderView(settings, finalProps, pages, dv);
	}
}
