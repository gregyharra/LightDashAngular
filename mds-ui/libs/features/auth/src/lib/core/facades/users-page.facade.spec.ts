import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { AuthService, ManagedUser } from '@mds-ui/core';
import { of } from 'rxjs';
import { UsersPageFacade } from './users-page.facade';
import { usersFeature } from '../store/users.reducer';

describe('UsersPageFacade', () => {
  const user: ManagedUser = {
    userUuid: 'u1',
    email: 'a@b.c',
    firstName: 'A',
    lastName: 'B',
    role: 'admin',
    isActive: true,
    createdAt: null,
  };

  it('loads users into the store', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStore({ [usersFeature.name]: usersFeature.reducer }),
        UsersPageFacade,
        {
          provide: AuthService,
          useValue: { listUsers: () => of([user]) },
        },
      ],
    });
    const facade = TestBed.inject(UsersPageFacade);

    facade.load();

    expect(facade.users()).toEqual([user]);
    expect(facade.loading()).toBe(false);
  });

  it('reloads after deactivating a user', () => {
    const listUsers = jest.fn(() => of([user]));
    const deactivateUser = jest.fn(() => of(null));
    TestBed.configureTestingModule({
      providers: [
        provideStore({ [usersFeature.name]: usersFeature.reducer }),
        UsersPageFacade,
        {
          provide: AuthService,
          useValue: { listUsers, deactivateUser },
        },
      ],
    });
    const facade = TestBed.inject(UsersPageFacade);

    facade.deactivate(user.userUuid);

    expect(deactivateUser).toHaveBeenCalledWith(user.userUuid);
    expect(listUsers).toHaveBeenCalled();
  });
});
