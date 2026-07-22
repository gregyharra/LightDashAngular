import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { AiChatMode } from '../../../core/models/ai.model';
import { AiAssistantService } from '../ai-assistant.service';
import { AiAssistantUiService } from '../ai-assistant-ui.service';

@Component({
  selector: 'app-ai-assistant-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ai-assistant-panel.component.html',
  styleUrl: './ai-assistant-panel.component.scss',
})
export class AiAssistantPanelComponent {
  protected readonly ui = inject(AiAssistantUiService);
  private readonly aiService = inject(AiAssistantService);
  private readonly activeProjectService = inject(ActiveProjectService);
  private readonly router = inject(Router);

  protected readonly draft = signal('');

  protected setMode(mode: AiChatMode): void {
    this.ui.setMode(mode);
  }

  protected close(): void {
    this.ui.closePanel();
  }

  protected clear(): void {
    this.ui.resetConversation();
  }

  protected send(): void {
    const projectUuid = this.activeProjectService.activeProjectUuid();
    const text = this.draft().trim();
    if (!projectUuid || !text || this.ui.loading()) {
      return;
    }

    const nextMessages = [
      ...this.ui.messages(),
      { role: 'user' as const, content: text },
    ];
    this.ui.messages.set(nextMessages);
    this.draft.set('');
    this.ui.loading.set(true);
    this.ui.error.set(null);

    this.aiService
      .chat(projectUuid, {
        messages: nextMessages,
        mode: this.ui.mode(),
        pageContext: this.router.url,
      })
      .subscribe({
        next: (response) => {
          this.ui.messages.update((messages) => [
            ...messages,
            { role: 'assistant', content: response.reply },
          ]);
          this.ui.lastProposal.set(response.proposedChart ?? null);
          this.ui.loading.set(false);
        },
        error: (err) => {
          this.ui.error.set(apiErrorMessage(err, 'AI request failed.'));
          this.ui.loading.set(false);
        },
      });
  }

  protected openProposedChart(): void {
    const projectUuid = this.activeProjectService.activeProjectUuid();
    const proposal = this.ui.lastProposal();
    if (!projectUuid || !proposal) {
      return;
    }
    void this.router.navigate(['/projects', projectUuid, 'charts', 'new'], {
      queryParams: { table: proposal.tableName },
    });
    this.ui.closePanel();
  }
}
