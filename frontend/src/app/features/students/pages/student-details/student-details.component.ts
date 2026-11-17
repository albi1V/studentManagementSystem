import { Component, inject } from '@angular/core';
import { DatePipe, SlicePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Student } from '../../models/student.model';
import { StudentsService } from '../../services/students.service';
@Component({selector:'app-student-details',standalone:true,imports:[DatePipe,SlicePipe,RouterLink],templateUrl:'./student-details.component.html',styleUrl:'./student-details.component.css'})
export class StudentDetailsComponent {
  private readonly students=inject(StudentsService); private readonly route=inject(ActivatedRoute); private readonly router=inject(Router);
  protected student:Student|null=null; protected loading=true; protected error=''; protected statusSaving=false;
  private readonly id=this.route.snapshot.paramMap.get('id')??'';
  constructor(){this.load();}
  protected load():void{
    this.loading=true;this.error='';
    this.students.get(this.id).subscribe({
      next:s=>{this.student=s;this.loading=false;},
      error:e=>{this.error=StudentsService.errorMessage(e,'Student details could not be loaded.');this.loading=false;}
    });
  }
  protected toggleStatus():void{
    if(!this.student||this.statusSaving)return;
    const active=this.student.status!=='Active';if(!confirm(`${active?'Activate':'Deactivate'} ${this.student.fullName}?`))return;
    this.statusSaving=true;
    this.students.updateStatus(this.student.id,active).subscribe({
      next:()=>{this.statusSaving=false;this.load();},
      error:e=>{this.error=StudentsService.errorMessage(e,'Student status could not be changed.');this.statusSaving=false;}
    });
  }
  protected edit():void{if(this.student)void this.router.navigate(['/students',this.student.id,'edit']);}
}
