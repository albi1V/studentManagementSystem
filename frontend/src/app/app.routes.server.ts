import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'students/:id/edit', renderMode: RenderMode.Server },
  { path: 'students/:id', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];