import { Injectable, inject } from '@angular/core';
import { AiAssistantService, AiAssistantUiService } from '@mds-ui/feature-ai';

@Injectable()
export class AiAssistantPanelFacade {
  private readonly ai = inject(AiAssistantService);
  private readonly ui = inject(AiAssistantUiService);
  readonly api = this.ai;
  readonly uiApi = this.ui;
}
