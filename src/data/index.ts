// Async functions shaped like API calls. Pages never call these directly: they pass them to useData or useAction
// from ./hooks. The production app keeps the names and signatures and swaps the made-up store for real requests.
//
// The pattern, once the design has business things in src/data/types.ts:
//
//   const items = table<Item>('items', seedItems);
//
//   export async function listItems(): Promise<Item[]> {
//     await delay();
//     return items.list();
//   }
//
//   export async function getItem(id: string): Promise<Item | undefined> {
//     await delay();
//     return items.get(id);
//   }
//
//   export async function saveItem(item: Item): Promise<Item> {
//     await delay();
//     allow('member');
//     return items.save(item);
//   }

export { resetDemoData } from './mock/store';
