import { Routes } from '@angular/router';
import { AiAssistantPanelComponent } from '@mds-ui/feature-ai';
import { AiAssistantPanelFacade } from './core/facades/ai-assistant-panel.facade';

export const AI_REMOTE_ROUTES: Routes = [
  { path: '', component: AiAssistantPanelComponent, providers: [AiAssistantPanelFacade] },
];
export { AiAssistantPanelComponent } from '@mds-ui/feature-ai';
