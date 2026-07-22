import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TimeTravelControlComponent } from './time-travel-control.component';

describe('TimeTravelControlComponent', () => {
  let fixture: ComponentFixture<TimeTravelControlComponent>;
  let component: TimeTravelControlComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TimeTravelControlComponent,
        FormsModule,
        MatButtonModule,
        MatIconModule,
        NoopAnimationsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeTravelControlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('emits ISO timestamp when datetime-local value changes', () => {
    const emissions: Array<{ asOfTimestamp: string } | null> = [];
    fixture.componentInstance.valueChange.subscribe((value) => {
      emissions.push(value);
    });

    component['onDatetimeChange']('2024-06-15T14:30');

    expect(emissions).toEqual([
      { asOfTimestamp: jasmine.stringMatching(/2024-06-15T\d{2}:30:00/) },
    ]);
    expect(component.resolveValue()?.asOfTimestamp).toBe(
      emissions[0]?.asOfTimestamp,
    );
  });

  it('clears time travel and emits null', () => {
    const emissions: Array<{ asOfTimestamp: string } | null> = [];
    fixture.componentInstance.valueChange.subscribe((value) => {
      emissions.push(value);
    });

    component['onDatetimeChange']('2024-06-15T14:30');
    component['clearTimeTravel']();

    expect(emissions.at(-1)).toBeNull();
    expect(component.resolveValue()).toBeNull();
  });

  it('resolveValue returns config without waiting for parent binding', () => {
    component['onDatetimeChange']('2024-06-15T14:30');

    expect(component.resolveValue()?.asOfTimestamp).toBeTruthy();
    expect(component.resolveValue()?.asOfTimestamp).toContain('2024-06-15');
  });
});
