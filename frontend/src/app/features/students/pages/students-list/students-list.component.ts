import { ChangeDetectorRef, Component, OnDestroy, inject } from '@angular/core';
import { Location } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, map, Subscription } from 'rxjs';
import { Student, StudentListResponse, StudentStatusFilter } from '../../models/student.model';
import { StudentsService } from '../../services/students.service';

@Component({ selector:'app-students-list', standalone:true, imports:[ReactiveFormsModule,RouterLink], templateUrl:'./students-list.component.html', styleUrl:'./students-list.component.css' })
export class StudentsListComponent implements OnDestroy {
  private readonly service=inject(StudentsService); private readonly router=inject(Router); private readonly location=inject(Location);
  private readonly changeDetector=inject(ChangeDetectorRef);
  private readonly searchSubscription:Subscription;
  private requestSubscription:Subscription|null=null; private latestRequestId=0;
  protected readonly search=new FormControl('',{nonNullable:true});
  protected statusFilter:StudentStatusFilter='all'; protected country=''; protected grade=''; protected mode=''; protected result:StudentListResponse|null=null;
  protected loading=true; protected error=''; protected notice=''; protected changingStudentId:string|null=null; protected page=1; protected readonly pageSize=10;
  constructor(){
    const state=(this.router.getCurrentNavigation()?.extras.state??this.location.getState()) as {notice?:string}; this.notice=typeof state?.notice==='string'?state.notice:'';
    this.searchSubscription=this.search.valueChanges.pipe(debounceTime(250),distinctUntilChanged()).subscribe(()=>{this.page=1;this.load();}); this.load();
  }
  protected get totalPages():number{return this.result?.totalPages||Math.max(1,Math.ceil((this.result?.totalCount??0)/this.pageSize));}
  protected initials(name:string):string{return name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();}
  protected load():void{
    const requestId=++this.latestRequestId;
    this.requestSubscription?.unsubscribe();
    this.loading=true;this.error='';this.changeDetector.markForCheck();
    this.requestSubscription=this.service.list(this.search.value,this.page,this.pageSize,this.statusFilter,this.country,this.grade,this.mode)
      .pipe(map(response=>this.normalizeResponse(response)),finalize(()=>{
        if(requestId!==this.latestRequestId)return;
        this.loading=false;this.changeDetector.markForCheck();
      }))
      .subscribe({
        next:response=>{if(requestId!==this.latestRequestId)return;this.result=response;this.changeDetector.markForCheck();},
        error:error=>{if(requestId!==this.latestRequestId)return;this.error=StudentsService.errorMessage(error,'Students could not be loaded.');this.changeDetector.markForCheck();}
      });
  }
  private normalizeResponse(response:StudentListResponse):StudentListResponse{
    if(!response||!Array.isArray(response.items))throw new Error('The students API returned an invalid list response.');
    const items=response.items.map(student=>({...student,status:(student.status?.toLowerCase()==='active'?'Active':'Inactive') as Student['status']}));
    const page=this.positiveInteger(response.page,1);const pageSize=this.positiveInteger(response.pageSize,this.pageSize);
    const totalCount=this.nonNegativeInteger(response.totalCount)??items.length;
    const totalStudents=this.nonNegativeInteger(response.totalStudents)??totalCount;
    const currentPageCountsAvailable=totalCount<=items.length;
    const activeCount=this.nonNegativeInteger(response.activeCount)??(currentPageCountsAvailable?items.filter(x=>x.status==='Active').length:0);
    const inactiveCount=this.nonNegativeInteger(response.inactiveCount)??(currentPageCountsAvailable?items.filter(x=>x.status==='Inactive').length:0);
    return {...response,items,page,pageSize,totalCount,totalStudents,activeCount,inactiveCount,
      totalPages:this.positiveInteger(response.totalPages,Math.max(1,Math.ceil(totalCount/pageSize))),
      countries:Array.isArray(response.countries)?response.countries:[],gradesOrYears:Array.isArray(response.gradesOrYears)?response.gradesOrYears:[],teachingModes:Array.isArray(response.teachingModes)?response.teachingModes:[]};
  }
  private positiveInteger(value:unknown,fallback:number):number{return typeof value==='number'&&Number.isInteger(value)&&value>0?value:fallback;}
  private nonNegativeInteger(value:unknown):number|null{return typeof value==='number'&&Number.isInteger(value)&&value>=0?value:null;}
  protected changeFilter(kind:'status'|'country'|'grade'|'mode',value:string):void{if(kind==='status')this.statusFilter=value==='active'||value==='inactive'?value:'all';else if(kind==='country')this.country=value;else if(kind==='grade')this.grade=value;else this.mode=value;this.page=1;this.load();}
  protected changePage(page:number):void{if(page<1||page>this.totalPages||page===this.page)return;this.page=page;this.load();}
  protected toggleStatus(student:Student):void{if(this.changingStudentId)return;const active=student.status!=='Active';if(!confirm(`${active?'Activate':'Deactivate'} ${student.fullName}?`))return;this.changingStudentId=student.id;this.service.updateStatus(student.id,active).subscribe({next:()=>{this.changingStudentId=null;this.load();},error:e=>{this.error=StudentsService.errorMessage(e,'Student status could not be changed.');this.changingStudentId=null;}});}
  ngOnDestroy():void{this.searchSubscription.unsubscribe();this.requestSubscription?.unsubscribe();}
}
