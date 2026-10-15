import {createRoot} from 'react-dom/client';
import Workspace from '../../app/workspace';
import '../../app/globals.css';
// Separate test-only entrypoint; never a Next route or an authentication bypass.
createRoot(document.getElementById('root')!).render(<Workspace/>);
