import { Injectable, signal } from '@angular/core';
import { AiChatMode, AiChatMessage, AiProposedChart } from '../../core/models/ai.model';

@Injectable({ providedIn: 'root' })
export class AiAssistantUiService {
  readonly open = signal(false);
  readonly mode = signal<AiChatMode>('ask');
  readonly messages = signal<AiChatMessage[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastProposal = signal<AiProposedChart | null>(null);

  openPanel(): void {
    this.open.set(true);
  }

  closePanel(): void {
    this.open.set(false);
  }

  togglePanel(): void {
    this.open.update((value) => !value);
  }

  setMode(mode: AiChatMode): void {
    this.mode.set(mode);
  }

  resetConversation(): void {
    this.messages.set([]);
    this.error.set(null);
    this.lastProposal.set(null);
  }
}
