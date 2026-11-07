// Single active print supplier. Historical project options remain in the database.
export type PrinterId = 'prodigi';
export const PRINTER_IDS:PrinterId[]=['prodigi'];
export function printerOption(id:PrinterId){return `printer:${id}`;}
export function printerFromOptions(options:unknown):PrinterId|null{return Array.isArray(options)&&options.includes('printer:prodigi')?'prodigi':null;}
