// App#getTheme() 타입만 보강
import "obsidian";

declare module "obsidian" {
  interface App {
    /** Returns "obsidian-dark" | "obsidian-light" */
    getTheme(): string;
  }
}
