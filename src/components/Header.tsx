/* Hallmark · component: Header · genre: modern-minimal · register: industrial-workbench
 * Re-export of standard Navbar component for backward and cross-module compatibility
 */

import { Navbar } from './layout/Navbar';
export { Navbar as Header, Navbar } from './layout/Navbar';
export type { ActiveNavTab, SqlStoreForwardMode } from './layout/Navbar';
export default Navbar;
