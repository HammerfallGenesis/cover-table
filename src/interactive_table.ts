import { App, TFile } from "obsidian";

export class InteractiveTable {
	private dv: any;

	// 정규표현식 캐싱 (날짜, 시간 파싱)
	private readonly dateYMDRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
	private readonly timeHMRegex = /^(\d{1,2}):(\d{1,2})$/;

	/* --------------------------------------------------------------------
	   [A] 뷰 ID 생성
	-------------------------------------------------------------------- */
	private resolveViewId(settings: any): string {
		let id = settings["id"];
		if (!id || typeof id !== "string") {
			id = "auto-" + Date.now() + "-" + Math.random().toString(16).slice(2, 6);
		}
		return id;
	}

	/* --------------------------------------------------------------------
	   [B] 로컬 스토리지 관련 (키 생성 헬퍼 포함)
	-------------------------------------------------------------------- */
	private getStorageKey(notePath: string, viewId: string): string {
		return `miniTableEngine::${notePath}::${viewId}`;
	}

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
	   refresh (다중 호출 코드 통합)
	-------------------------------------------------------------------- */
	private refreshCommand(delay: number = 50) {
		setTimeout(() => {
			app.commands.executeCommandById("dataview:dataview-force-refresh-views");
		}, delay);
	}

	/* --------------------------------------------------------------------
	   [C] 버튼들
	-------------------------------------------------------------------- */
	async viewFolderButton(relPath: string, container: HTMLElement) {
		const btn = document.createElement("button");
		btn.className = "dvit-button folder-button";
		btn.append("↪ Open Folder");
		btn.onclick = async () => {
			try {
				const { shell } = (window as any).require("electron");
				const pathMod = (window as any).require("path");
				if (!shell) {
					new (globalThis as any).miniTableGlobal.obsidian.Notice("Electron shell is undefined!");
					return;
				}
				const vaultBase = (app.vault.adapter as any).basePath;
				const absolutePath = pathMod.resolve(vaultBase, relPath);
				const isFile = pathMod.extname(absolutePath) !== "";
				if (isFile) {
					shell.showItemInFolder(absolutePath);
				} else {
					shell.openPath(absolutePath);
				}
			} catch (e: any) {
				new (globalThis as any).miniTableGlobal.obsidian.Notice(`Error:\n${e.message}`);
			}
		};
		container.append(btn);
	}

	async newFolderButton(dv: any, args: { folderName?: string }, container: HTMLElement) {
		let { folderName } = args;
		if (!folderName) folderName = "New Folder";
		const btn = document.createElement("button");
		btn.className = "dvit-button folder-button";
		btn.append("+ 새 폴더");
		btn.onclick = async () => {
			const inputName = await this.textInput(folderName);
			if (!inputName) return;
			const currentFolder = dv.current().file.folder || "";
			const finalPath = currentFolder ? `${currentFolder}/${inputName}` : inputName;
			try {
				await app.vault.createFolder(finalPath);
				new (globalThis as any).miniTableGlobal.obsidian.Notice(`Folder created: ${finalPath}`);
			} catch (er) {
				new (globalThis as any).miniTableGlobal.obsidian.Notice(`Error creating folder:\n${finalPath}`);
			}
		};
		container.append(btn);
	}

	async refreshButton(container: HTMLElement, notePath: string, viewId: string) {
		const btn = document.createElement("button");
		btn.className = "dvit-button";
		btn.style.marginRight = "8px";
		btn.append("↺");
		btn.onclick = async () => {
			this._setState(notePath, viewId, `sort_${viewId}`, null);
			this._setState(notePath, viewId, `sort_direction_${viewId}`, "asc");
			this.refreshCommand(50);
		};
		container.append(btn);
	}

	/* --------------------------------------------------------------------
	   [D] getVal: 중첩 프로퍼티 접근 최적화 (for 루프 사용)
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
	   [E] 날짜/시간/숫자 정렬 & 포맷
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
	   [F] 태그 필터
	-------------------------------------------------------------------- */
	private async renderTagFilterButton(pages: any[], container: HTMLElement, notePath: string, viewId: string) {
		try {
			const currentTag = this._getState(notePath, viewId, "tagFilter") || "ALL";
			const btn = document.createElement("button");
			btn.className = "dvit-button tag-filter-button";
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
	   [G] frontmatter 필터 + 검색
	-------------------------------------------------------------------- */
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

	/**
	 * file.link 검색 시 "frontmatter.title"만 검색 대상으로 사용
	 */
	private buildSearchTextMap(props: any[], pages: any[]) {
		const tableProps = props.filter((c) => c.column);
		pages.forEach((pg) => {
			const buf: string[] = [];
			tableProps.forEach((col) => {
				let tv: string;
				if (col.prop === "file.link") {
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

	private async searchInput(container: HTMLElement, notePath: string, viewId: string) {
		const wrap = document.createElement("div");
		wrap.className = "dvit-search-wrapper";
		wrap.style.display = "flex";
		wrap.style.alignItems = "center";

		const sKey = `search_${viewId}`;
		const sVal = this._getState(notePath, viewId, sKey) || "";
		const wasFocused = this._getState(notePath, viewId, `search_focus_${viewId}`) === true;

		const input = document.createElement("input");
		input.className = "dvit-search-input";
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

		const btn = document.createElement("button");
		btn.className = "dvit-button dvit-search-button";
		btn.innerText = "⌕";
		btn.onclick = async () => {
			this._setState(notePath, viewId, sKey, input.value);
			this._setState(notePath, viewId, `search_ready_${viewId}`, true);
			this.refreshCommand(80);
			setTimeout(() => input.focus(), 80);
		};
		wrap.appendChild(btn);

		container.appendChild(wrap);
	}

	/* --------------------------------------------------------------------
	   [H] 페이지네이션
	-------------------------------------------------------------------- */
	private paginate(arr: any[], per: number, notePath: string, viewId: string) {
		const key = `pagination_${viewId}`;
		// 새로 계산된 총 페이지 수
		const totalPages = per > 0 ? Math.ceil(arr.length / per) : 1;
		// 저장된 현재 페이지 인덱스
		let pageIdx = this._getState(notePath, viewId, key) || 0;
	
		// ▶ 필터/검색 후 totalPages가 줄어들었으면, 마지막 페이지(인덱스)로 클램프
		if (pageIdx >= totalPages) {
		  pageIdx = totalPages - 1;
		  this._setState(notePath, viewId, key, pageIdx);
		}
	
		// 실제 슬라이스
		return per > 0
		  ? arr.slice(pageIdx * per, (pageIdx + 1) * per)
		  : [...arr];
	  }

	  private async paginationBlock(
		data: any[],
		per: number,
		container: HTMLElement,
		notePath: string,
		viewId: string
	  ) {
		const key = `pagination_${viewId}`;
		const totalPages = Math.ceil(data.length / per);
		const wrap = document.createElement("div");
		wrap.className = "pagination-block";
	
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

	private async nextPageButton(totalPages: number, storeKey: string, notePath: string, viewId: string) {
		const cv = this._getState(notePath, viewId, storeKey) || 0;
		const canNext = cv + 1 < totalPages;
		const bClass = canNext ? "dvit-button" : "dvit-button button-gray";

		const btn = document.createElement("button");
		btn.className = bClass;
		btn.append(">>");
		btn.onclick = async () => {
			if (!canNext) return;
			this._setState(notePath, viewId, storeKey, cv + 1);
			this.refreshCommand(60);
		};
		return btn;
	}

	private async prevPageButton(totalPages: number, storeKey: string, notePath: string, viewId: string) {
		const cv = this._getState(notePath, viewId, storeKey) || 0;
		const canPrev = cv > 0;
		const bClass = canPrev ? "dvit-button" : "dvit-button button-gray";

		const btn = document.createElement("button");
		btn.className = bClass;
		btn.append("<<");
		btn.onclick = async () => {
			if (!canPrev) return;
			this._setState(notePath, viewId, storeKey, cv - 1);
			this.refreshCommand(60);
		};
		return btn;
	}

	/* --------------------------------------------------------------------
	   [I] 테이블 생성 (필터/정렬/페이지네이션 적용)
	-------------------------------------------------------------------- */
	private async createTable(
		props: any[],
		pages: any[],
		container: HTMLElement,
		notePath: string,
		viewId: string,
		entriesPerPage: number,
		settings: any
	) {
		// 1) 각 page에 대해 __fmTitle 세팅
		pages.forEach((pg) => {
			try {
				const dvPage = this.dv?.page(pg.file.path);
				if (dvPage) {
					pg.__fmTitle = dvPage?.frontmatter?.title || dvPage?.title || "";
				} else {
					pg.__fmTitle = pg.frontmatter?.title || "";
				}
			} catch {
				pg.__fmTitle = pg.frontmatter?.title || "";
			}
		});

		// 2) 필터 및 검색
		let filtered = await this.filterProps(props, pages, notePath, viewId);

		// 3) 정렬 처리
		const sKey = `sort_${viewId}`;
		const dKey = `sort_direction_${viewId}`;
		let curSort = this._getState(notePath, viewId, sKey);
		let curDir = this._getState(notePath, viewId, dKey) || "asc";
		if (!curSort) {
			filtered.sort((a, b) => a.__fmTitle.localeCompare(b.__fmTitle));
		} else {
			filtered = this.sortByProp(filtered, curSort, curDir);
		}

		// 4) 페이지네이션 적용
		const disp = entriesPerPage ? this.paginate(filtered, entriesPerPage, notePath, viewId) : [...filtered];

		// 5) 테이블 헤더 구성
		const headers: string[] = [];
		props.forEach((col) => {
			const hd = document.createElement("div");
			if (col.prop === "file.link") {
				hd.classList.add("header-no-sort");
			} else {
				hd.classList.add("header-sorting-button");
				hd.setAttribute("data-prop", col.prop);
				hd.setAttribute("data-view-id", viewId);
			}
			hd.innerText = col.name || col.prop;
			headers.push(hd.outerHTML);
		});

		// 6) 테이블 내용 구성
		const rows = disp.map((pg) => {
			const rowCells: string[] = [];
			for (const col of props) {
				let val = this.getVal(pg, col.prop);
				if (col.prop === "file.link") {
					const alias = pg.__fmTitle || "";
					if (typeof val === "object" && val?.path) {
						const linkMarkup = alias.trim() === ""
							? `[[${val.path}]]`
							: `[[${val.path}|${alias}]]`;
						rowCells.push(`<div class="edit-button" data-path="${pg.file?.path || ""}" data-prop="file.link">${linkMarkup}</div>`);
					} else {
						if (alias.trim() === "") {
							rowCells.push(`<div class="edit-button" data-path="${pg.file?.path || ""}" data-prop="file.link">[[${(val && typeof val === "object" && val?.path) ? val.path : ""}]]</div>`);
						} else {
							rowCells.push(`<div class="edit-button" data-path="${pg.file?.path || ""}" data-prop="file.link">${alias}</div>`);
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
					rowCells.push(`<div class="edit-button" data-path="${pg.file?.path || ""}" data-prop="${col.prop}">${val}</div>`);
				}
			}
			return rowCells;
		});

		const mdTable = this.dv.markdownTable(headers, rows);
		const wrapP = this.dv.paragraph(mdTable);
		wrapP.classList.add("dv-table-wrapper", "table", "full-width");
		container.appendChild(wrapP);

		// 7) 셀 편집 이벤트 (데모)
		wrapP.querySelectorAll(".edit-button").forEach((btn) => {
			btn.addEventListener("click", async (e: any) => {
				if (e.target.localName === "a") return;
				const path = btn.getAttribute("data-path");
				const prop = btn.getAttribute("data-prop");
				if (path && prop) await this.editProp("text", path, prop);
			});
		});

		// 8) 헤더 정렬 이벤트
		const hdrBtns = wrapP.querySelectorAll(".header-sorting-button");
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
	   [J] 편집 (데모)
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
			await app.vault.rename(file, newPath);
			this.refreshCommand(50);
			return;
		}
		this.refreshCommand(50);
	}

	/* --------------------------------------------------------------------
	   [K] 텍스트 입력 모달 (데모)
	-------------------------------------------------------------------- */
	private async textInput(defaultVal: string) {
		return new Promise<string | null>((resolve) => {
			const { Modal } = (globalThis as any).miniTableGlobal.obsidian;
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

	/* --------------------------------------------------------------------
	   [L] Suggester
	-------------------------------------------------------------------- */
	private async suggester(vals: string[]) {
		const { SuggestModal } = (globalThis as any).miniTableGlobal.obsidian;
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
	   [M] 정렬 (file.link은 별도 정렬하지 않음)
	-------------------------------------------------------------------- */
	private sortByProp(pages: any[], prop: string | null, dir: string) {
		if (!prop || prop === "file.link") return pages;
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
	   [N] DataviewJS 엔트리 포인트: renderView
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
			containerDiv.classList.add(`dvit-view-id-${id}`);
			dv.container.append(containerDiv);

			// 상단 영역 구성
			const topRow = document.createElement("div");
			topRow.classList.add("dvit-top-row");
			topRow.style.display = "flex";
			topRow.style.justifyContent = "space-between";
			topRow.style.alignItems = "center";
			containerDiv.appendChild(topRow);

			const leftArea = document.createElement("div");
			leftArea.className = "dvit-left-area";
			const centerArea = document.createElement("div");
			centerArea.className = "dvit-center-area";
			const rightArea = document.createElement("div");
			rightArea.className = "dvit-right-area";
			topRow.append(leftArea, centerArea, rightArea);

			if (settings.path) {
				await this.viewFolderButton(settings.path, leftArea);
			}
			if (settings["add new folder button"]) {
				await this.newFolderButton(dv, { folderName: settings["new folder name"] || "NewFolder" }, leftArea);
			}
			await this.renderTagFilterButton(pages, leftArea, notePath, id);
			await this.refreshButton(rightArea, notePath, id);
			await this.searchInput(rightArea, notePath, id);

			const fmRow = document.createElement("div");
			fmRow.className = "frontmatter-filter-area";
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

	private async filterButtonProps(props: any[], pages: any[], container: HTMLElement, notePath: string, viewId: string) {
		const flt = props.filter((pp) => pp.filter);
		if (flt.length === 0) return;
		const wrap = document.createElement("div");
		wrap.className = "frontmatter-filter-area";
		for (const p of flt) {
			const b = await this.makeFilterButton(p, pages, notePath, viewId);
			wrap.appendChild(b);
		}
		container.appendChild(wrap);
	}

	private async makeFilterButton(p: any, pages: any[], notePath: string, viewId: string) {
		const btn = document.createElement("button");
		btn.className = "dvit-button";
		const nm = p.name || p.prop;
		btn.append(nm);
		btn.onclick = async () => {
			await this.changePropFilter(p, pages, notePath, viewId);
		};
		return btn;
	}

	/* --------------------------------------------------------------------
	   renderAutoView (현재 노트 폴더의 md 문서 및 .canvas 파일 자동 수집)
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
		const canvasFiles = app.vault.getFiles()
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
			{ prop: "file.link", name: "Title", filter: false, column: true },
			{ prop: "created",   name: "Created", filter: true, column: true },
			{ prop: "status",    name: "Status",  filter: true, column: true },
		];
		const finalProps = settings.props || defaultProps;

		// (6) renderView 호출
		await this.renderView(settings, finalProps, pages, dv);
	}
}
