import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DbtTreeNode } from '../../../core/models/lineage.model';
import { FolderSearchPanelComponent } from './folder-search-panel.component';

function folder(name: string, children: DbtTreeNode[], path = name): DbtTreeNode {
  return { id: `folder:${path}`, name, path, type: 'folder', children };
}

function leaf(name: string, lineageNodeId: string): DbtTreeNode {
  return {
    id: lineageNodeId,
    name,
    path: `models/${name}.sql`,
    type: 'model',
    lineageNodeId,
  };
}

describe('FolderSearchPanelComponent', () => {
  let fixture: ComponentFixture<FolderSearchPanelComponent>;
  let component: FolderSearchPanelComponent;

  const tree: DbtTreeNode[] = [
    folder(
      'models',
      [folder('marts', [leaf('customer order summary', 'model.j.customer_order_summary')], 'models/marts')],
      'models',
    ),
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FolderSearchPanelComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(FolderSearchPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('tree', tree);
    fixture.componentRef.setInput('projectUuid', 'test-project');
  });

  it('expands ancestors when a leaf is selected, then allows manual collapse to stick', fakeAsync(() => {
    fixture.componentRef.setInput('selectedNodeId', 'model.j.customer_order_summary');
    fixture.detectChanges();
    tick();

    const expanded = () => (component as unknown as { expandedPaths: { (): Set<string> } }).expandedPaths();
    expect(expanded().has('models')).toBeTrue();
    expect(expanded().has('models/marts')).toBeTrue();

    const event = new Event('click');
    (component as unknown as { toggleFolder: (path: string, event: Event) => void }).toggleFolder(
      'models',
      event,
    );
    fixture.detectChanges();
    tick();

    expect(expanded().has('models')).toBeFalse();
    expect(expanded().has('models/marts')).toBeTrue();
  }));

  it('re-expands ancestors when selection changes to another leaf under a collapsed path', fakeAsync(() => {
    fixture.componentRef.setInput('selectedNodeId', 'model.j.customer_order_summary');
    fixture.detectChanges();
    tick();

    const api = component as unknown as {
      expandedPaths: { (): Set<string> };
      toggleFolder: (path: string, event: Event) => void;
    };

    api.toggleFolder('models', new Event('click'));
    fixture.detectChanges();
    tick();
    expect(api.expandedPaths().has('models')).toBeFalse();

    const otherTree: DbtTreeNode[] = [
      folder(
        'models',
        [
          folder(
            'marts',
            [
              leaf('customer order summary', 'model.j.customer_order_summary'),
              leaf('orders', 'model.j.orders'),
            ],
            'models/marts',
          ),
        ],
        'models',
      ),
    ];
    fixture.componentRef.setInput('tree', otherTree);
    fixture.componentRef.setInput('selectedNodeId', 'model.j.orders');
    fixture.detectChanges();
    tick();

    expect(api.expandedPaths().has('models')).toBeTrue();
    expect(api.expandedPaths().has('models/marts')).toBeTrue();
  }));
});
