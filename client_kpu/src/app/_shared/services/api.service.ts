import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';

import { catchError, timeout, retry, map } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

import { GlobalService } from './global.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(
    private http: HttpClient,
    private gs: GlobalService,
  ) {}

  downloadFile(path: string): Observable<any> {
    this.gs.log('[API_DOWNLOAD]', path);
    return this.http.get(environment.apiUrl + path, {
      observe: 'response',
      responseType: 'blob'
    }).pipe(
      catchError(err => throwError(err)),
      map(res => {
        const contentType = res.headers.get('content-type');
        const contentDisposition = res.headers.get('content-disposition');
        const fileName = contentDisposition.substr(contentDisposition.indexOf('filename=') + 9).replace(/\"/g, '');
        const fileData = new Blob([res.body], { type: contentType });
        return { fileName, fileData };
      })
    );
  }

  getData(path: string, timedOut = 5000): Observable<any> {
    this.gs.log('[API_GET]', path);
    return this.http.get(path.startsWith('http') ? environment.sniffCors + path : environment.apiUrl + path).pipe(
      catchError(err => throwError(err)),
      map(res => res), timeout(timedOut), retry(3)
    );
  }

  postData(path: string, model = {}, multipart = false, timedOut = 60000): Observable<any> {
    this.gs.log('[API_POST]', path);
    const options = {};
    let body = model;
    let timer = timedOut;
    if (multipart) {
      const headers = new HttpHeaders().append('Content-Type', 'multipart/form-data');
      Object.assign(options, { headers });
      body = this.prepareFormData(model);
      timer = 90000;
    }
    return this.http.post(path.startsWith('http') ? environment.sniffCors + path : environment.apiUrl + path, body, options).pipe(
      catchError(err => throwError(err)),
      map(res => res), timeout(timer)
    );
  }

  putData(path: string, model = {}, multipart = false, timedOut = 30000): Observable<any> {
    this.gs.log('[API_PUT]', path);
    const options = {};
    let body = model;
    if (multipart) {
      const headers = new HttpHeaders().append('Content-Type', 'multipart/form-data');
      Object.assign(options, { headers });
      body = this.prepareFormData(model);
    }
    return this.http.put(path.startsWith('http') ? environment.sniffCors + path : environment.apiUrl + path, body, options).pipe(
      catchError(err => throwError(err)),
      map(res => res), timeout(timedOut)
    );
  }

  deleteData(path: string, timedOut = 15000): Observable<any> {
    this.gs.log('[API_DEL]', path);
    return this.http.delete(path.startsWith('http') ? environment.sniffCors + path : environment.apiUrl + path).pipe(
      catchError(err => throwError(err)),
      map(res => res), timeout(timedOut)
    );
  }

  private prepareFormData(data: any) {
    const formData = new FormData();
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        formData.append(key, data[key]);
      }
    }
    return formData;
  }
}
