import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '@mds-ui/core';
import { AiChatRequest, AiChatResponse } from '@mds-ui/models';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly api = inject(LightdashApiService);

  chat(projectUuid: string, payload: AiChatRequest): Observable<AiChatResponse> {
    return this.api.post<AiChatResponse>(
      `/projects/${projectUuid}/ai/chat`,
      payload,
    );
  }
}
