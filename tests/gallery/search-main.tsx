import {createRoot} from 'react-dom/client';
import SearchPage from '../../app/buscar/search-page';
import '../../app/globals.css';
// Separate test-only entrypoint. Authentication and the real API are not bypassed in the published app.
createRoot(document.getElementById('root')!).render(<SearchPage/>);
