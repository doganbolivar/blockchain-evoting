import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CookieService } from 'ngx-cookie-service';

import { environment } from 'src/environments/environment';

import { GlobalService } from './global.service';

import User from '../models/user';
import { CryptoService } from './crypto.service';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private currentUserSubject: BehaviorSubject<User>;
  public currentUser: Observable<User>;

  constructor(
    private http: HttpClient,
    private router: Router,
    private gs: GlobalService,
    private crypt: CryptoService,
    private cs: CookieService
  ) {
    let token = null;
    let userSession = null;
    try {
      token = localStorage.getItem(environment.tokenName);
      const userEncrypted = localStorage.getItem(environment.sessionName);
      const userDecrypted = this.crypt.decrypt(userEncrypted, token);
      userSession = JSON.parse(userDecrypted);
    } catch (e) {
      localStorage.removeItem(environment.sessionName);
    }
    this.currentUserSubject = new BehaviorSubject<User>(userSession);
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue() {
    return this.currentUserSubject.value;
  }

  verify(token: string) {
    this.gs.log('[AUTH_VERIFY]', token);
    return this.http.post<any>(`${environment.apiUrl}/verify`, { token })
      .pipe(map(respVerify => {
        this.currentUserSubject.next(respVerify.result.user);
        const userSession = JSON.stringify(respVerify.result.user);
        const userEncrypted = this.crypt.encrypt(userSession, token);
        localStorage.setItem(environment.sessionName, userEncrypted);
        return respVerify.result.user;
      }));
  }

  login(loginData: any) {
    this.gs.log('[AUTH_LOGIN]', loginData);
    return this.http.post<any>(`${environment.apiUrl}/login`, loginData);
  }

  logout() {
    this.currentUserSubject.next(null);
    localStorage.removeItem(environment.sessionName);
    localStorage.removeItem(environment.tokenName);
    this.router.navigate(['/login']);
  }

  register(registerData: any) {
    this.gs.log('[AUTH_REGISTER]', registerData);
    return this.http.post<any>(`${environment.apiUrl}/register`, registerData)
      .pipe(map(respRegister => {
        localStorage.setItem(environment.tokenName, respRegister.result.token);
      }));
  }

}
