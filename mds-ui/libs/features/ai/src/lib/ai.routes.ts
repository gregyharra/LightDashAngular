import { Routes } from '@angular/router';
import { AiAssistantPanelComponent } from './ai-assistant-panel/ai-assistant-panel.component';
import { AiAssistantPanelFacade } from './core/facades/ai-assistant-panel.facade';

export const AI_REMOTE_ROUTES: Routes = [
  { path: '', component: AiAssistantPanelComponent, providers: [AiAssistantPanelFacade] },
];
