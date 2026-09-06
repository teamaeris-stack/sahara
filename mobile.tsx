import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';

const element=document.getElementById('root');
if(!element)throw new Error('Missing mobile root');
createRoot(element).render(<RouterProvider router={getRouter()} />);
