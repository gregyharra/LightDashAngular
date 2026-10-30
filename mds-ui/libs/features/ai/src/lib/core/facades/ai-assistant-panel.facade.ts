import { Injectable, inject } from '@angular/core';
import { AiAssistantService } from '../../ai-assistant.service';
import { AiAssistantUiService } from '../../ai-assistant-ui.service';

@Injectable()
export class AiAssistantPanelFacade {
  private readonly ai = inject(AiAssistantService);
  private readonly ui = inject(AiAssistantUiService);
  readonly api = this.ai;
  readonly uiApi = this.ui;
}
