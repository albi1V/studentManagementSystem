import { Component, OnDestroy, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { StudentsService } from '../../services/students.service';
import { StudentOnboardingRequest, StudentRequest } from '../../models/student.model';
type AvailabilityRow = FormGroup<{dayOfWeek:FormControl<string>;startLocalTime:FormControl<string>;endLocalTime:FormControl<string>}>;

@Component({selector:'app-student-editor',standalone:true,imports:[ReactiveFormsModule,RouterLink],templateUrl:'./student-editor.component.html',styleUrl:'./student-editor.component.css'})
export class StudentEditorComponent implements OnDestroy {
  private readonly students=inject(StudentsService); private readonly route=inject(ActivatedRoute); private readonly router=inject(Router);
  protected readonly studentId=this.route.snapshot.paramMap.get('id'); protected readonly editing=this.studentId!==null;
  protected readonly form=new FormGroup({
    fullName:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.minLength(2),Validators.maxLength(100)]}),
    preferredName:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(100)]}),dateOfBirth:new FormControl('',{nonNullable:true}),
    gradeOrYear:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(100)]}),
    email:new FormControl('',{nonNullable:true,validators:[Validators.email,Validators.maxLength(254)]}),
    phoneNumber:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(30),Validators.pattern(/^\+?[0-9().\s-]{6,30}$/)]}),
    notes:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(2000)]}),
    guardianName:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.minLength(2),Validators.maxLength(100)]}),
    guardianRelationship:new FormControl('',{nonNullable:true,validators:[Validators.required]}),
    guardianEmail:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.email,Validators.maxLength(254)]}),
    guardianPhone:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(30),Validators.pattern(/^\+?[0-9().\s-]{6,30}$/)]}),
    country:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(100)]}),
    stateOrProvince:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(100)]}),
    city:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(100)]}),
    timeZoneId:new FormControl('',{nonNullable:true,validators:[Validators.required]}),timezoneConfirmed:new FormControl(false,{nonNullable:true,validators:[Validators.requiredTrue]}),
    preferredTeachingLanguage:new FormControl('',{nonNullable:true,validators:[Validators.required,Validators.maxLength(100)]}),
    additionalLanguagesText:new FormControl('',{nonNullable:true}),learningNotes:new FormControl('',{nonNullable:true,validators:[Validators.maxLength(2000)]}),
    customSubject:new FormControl('',{nonNullable:true}),teachingMode:new FormControl<string>('',{nonNullable:true,validators:[Validators.required]}),
    duration:new FormControl(60,{nonNullable:true,validators:[Validators.required]}),
    availability:new FormArray<FormGroup<{dayOfWeek:FormControl<string>;startLocalTime:FormControl<string>;endLocalTime:FormControl<string>}>>([]),
  });
  protected readonly stepNames=['Student Details','Parent / Guardian Details','Location and Timezone','Academic Details','Teaching Arrangement','Review and Save'];
  protected readonly subjects=['Mathematics','English','Science','Biology','Chemistry','Physics','History','Geography','Computer Science','Art','Music','Other'];
  protected readonly languages=['English','Spanish','French','Hindi','Arabic','Mandarin Chinese','Portuguese','Bengali','Japanese','German','Other'];
  protected readonly days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  protected readonly timeZones=this.getTimeZones();
  protected selectedSubjects:string[]=[]; protected currentStep=0; protected saving=false; protected loading=false; protected error='';
  private zoneSubscription:Subscription;
  constructor(){
    this.zoneSubscription=this.form.controls.timeZoneId.valueChanges.subscribe(()=>this.form.controls.timezoneConfirmed.setValue(false));
    if(!this.studentId)return; this.loading=true;
    this.students.get(this.studentId).subscribe({next:s=>{
      const guardian=s.guardians?.find(x=>x.isPrimary)??s.guardians?.[0];
      this.form.patchValue({fullName:s.fullName,preferredName:s.preferredName??'',dateOfBirth:s.dateOfBirth??'',gradeOrYear:s.gradeOrYear??'',email:s.email??'',phoneNumber:s.phoneNumber??'',notes:s.notes??'',guardianName:guardian?.fullName??'',guardianRelationship:guardian?.relationship??'',guardianEmail:guardian?.email??'',guardianPhone:guardian?.phoneNumber??'',country:s.country??'',stateOrProvince:s.stateOrProvince??'',city:s.city??'',timeZoneId:s.timeZoneId??'',timezoneConfirmed:!!s.timeZoneId,preferredTeachingLanguage:s.preferredTeachingLanguage??'',additionalLanguagesText:(s.additionalLanguages??[]).join(', '),learningNotes:s.learningNotes??'',teachingMode:s.teachingArrangement?.teachingMode??'',duration:s.teachingArrangement?.defaultClassDurationMinutes??60},{emitEvent:false});
      this.selectedSubjects=[...(s.subjects??[])]; for(const item of s.availability??[])this.availability.push(new FormGroup({dayOfWeek:new FormControl(item.dayOfWeek,{nonNullable:true,validators:[Validators.required]}),startLocalTime:new FormControl(item.startLocalTime.slice(0,5),{nonNullable:true,validators:[Validators.required]}),endLocalTime:new FormControl(item.endLocalTime.slice(0,5),{nonNullable:true,validators:[Validators.required]})}));
      this.loading=false;
    },error:e=>{this.error=StudentsService.errorMessage(e,'Student details could not be loaded.');this.loading=false;}});
  }
  ngOnDestroy():void{this.zoneSubscription.unsubscribe();}
  protected get availability():FormArray<AvailabilityRow>{return this.form.controls.availability;}
  protected get currentTimeInZone():string{
    const zone=this.form.controls.timeZoneId.value;if(!zone)return '';
    try{return new Intl.DateTimeFormat(undefined,{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date());}catch{return '';}
  }
  protected addCustomSubject(event:Event):void{event.preventDefault();const input=this.form.controls.customSubject;const value=input.value.trim().replace(/\s+/g,' ');if(value&&!this.selectedSubjects.some(x=>x.toLowerCase()===value.toLowerCase()))this.selectedSubjects=[...this.selectedSubjects,value];input.setValue('');}
  protected selectSubject(subject:string,event:Event):void{const checked=(event.target as HTMLInputElement).checked;this.selectedSubjects=checked?[...this.selectedSubjects,subject]:this.selectedSubjects.filter(x=>x!==subject);}
  protected addAvailability():void{this.availability.push(new FormGroup({dayOfWeek:new FormControl('',{nonNullable:true,validators:[Validators.required]}),startLocalTime:new FormControl('',{nonNullable:true,validators:[Validators.required]}),endLocalTime:new FormControl('',{nonNullable:true,validators:[Validators.required]})}));}
  protected removeAvailability(index:number):void{this.availability.removeAt(index);}
  protected validRow(row:AvailabilityRow):boolean{const value=row.getRawValue() as {dayOfWeek:string;startLocalTime:string;endLocalTime:string};return !!value.dayOfWeek&&!!value.startLocalTime&&!!value.endLocalTime&&value.endLocalTime>value.startLocalTime;}
  protected continue():void{
    if(this.currentStep===3&&this.selectedSubjects.length===0){this.error='Select at least one subject to continue.';return;}
    if(this.currentStep===4&&!this.validAvailability()){this.availability.markAllAsTouched();this.error='Check each preferred availability window. End time must be after start time.';return;}
    const fields=this.fieldsByStep[this.currentStep];let valid=true;
    for(const field of fields){const control=this.form.get(field);control?.markAsTouched();if(control?.invalid)valid=false;}
    if(!valid){this.error='Complete the required fields highlighted below.';return;}
    this.error='';this.currentStep=Math.min(5,this.currentStep+1);
  }
  protected previous():void{this.error='';this.currentStep=Math.max(0,this.currentStep-1);}
  protected editStep(step:number):void{this.error='';this.currentStep=step;}
  protected submit():void{
    if(this.saving)return;
    if(this.editing){this.submitEdit();return;}
    if(this.currentStep!==5)return;
    this.form.markAllAsTouched();
    const required=this.fieldsByStep.slice(0,5).flat();
    if(required.some(key=>this.form.get(key)?.invalid)||!this.selectedSubjects.length||!this.validAvailability()||!this.form.controls.timezoneConfirmed.value){this.error='Review the form and complete every required step before saving.';return;}
    this.saving=true;this.error='';const v=this.form.getRawValue();
    const request:StudentOnboardingRequest={
      fullName:this.clean(v.fullName),preferredName:this.optional(v.preferredName),dateOfBirth:v.dateOfBirth||null,gradeOrYear:this.clean(v.gradeOrYear),email:this.optional(v.email),phoneNumber:this.optional(v.phoneNumber),notes:this.optional(v.notes),
      guardian:{fullName:this.clean(v.guardianName),relationship:v.guardianRelationship,email:v.guardianEmail.trim(),phoneNumber:this.optional(v.guardianPhone)},
      country:this.clean(v.country),stateOrProvince:this.optional(v.stateOrProvince),city:this.clean(v.city),timeZoneId:v.timeZoneId.trim(),
      preferredTeachingLanguage:this.clean(v.preferredTeachingLanguage),additionalLanguages:v.additionalLanguagesText.split(',').map(x=>x.trim()).filter(Boolean),learningNotes:this.optional(v.learningNotes),subjects:this.selectedSubjects,
      teachingArrangement:{teachingMode:v.teachingMode as 'OneToOne'|'Group',defaultClassDurationMinutes:Number(v.duration)},
      availability:v.availability.map(x=>({dayOfWeek:x.dayOfWeek,startLocalTime:this.toApiTime(x.startLocalTime),endLocalTime:this.toApiTime(x.endLocalTime)})),
    };
    this.students.createOnboarded(request).pipe(finalize(()=>this.saving=false)).subscribe({next:()=>void this.router.navigate(['/students'],{state:{notice:'Student successfully onboarded.'}}),error:e=>{this.error=StudentsService.errorMessage(e,'Student onboarding failed. Review the details and try again.');}});
  }
  protected submitEdit():void{
    if(!this.studentId)return;this.form.markAllAsTouched();if(this.form.invalid||!this.selectedSubjects.length||!this.validAvailability()||!this.form.controls.timezoneConfirmed.value){this.error='Review the form and complete every required step before saving.';return;}this.saving=true;this.error='';const v=this.form.getRawValue();
    const req:StudentRequest={fullName:this.clean(v.fullName),preferredName:this.optional(v.preferredName),dateOfBirth:v.dateOfBirth||null,gradeOrYear:this.optional(v.gradeOrYear),email:this.optional(v.email),phoneNumber:this.optional(v.phoneNumber),notes:this.optional(v.notes),guardian:{fullName:this.clean(v.guardianName),relationship:v.guardianRelationship,email:v.guardianEmail.trim(),phoneNumber:this.optional(v.guardianPhone)},country:this.optional(v.country),stateOrProvince:this.optional(v.stateOrProvince),city:this.optional(v.city),timeZoneId:v.timeZoneId.trim(),preferredTeachingLanguage:this.optional(v.preferredTeachingLanguage),learningNotes:this.optional(v.learningNotes),subjects:this.selectedSubjects,additionalLanguages:v.additionalLanguagesText.split(',').map(x=>x.trim()).filter(Boolean),teachingArrangement:{teachingMode:v.teachingMode as 'OneToOne'|'Group',defaultClassDurationMinutes:Number(v.duration)},availability:v.availability.map(x=>({dayOfWeek:x.dayOfWeek,startLocalTime:this.toApiTime(x.startLocalTime),endLocalTime:this.toApiTime(x.endLocalTime),timeZoneId:v.timeZoneId.trim()}))};
    this.students.update(this.studentId,req).pipe(finalize(()=>this.saving=false)).subscribe({next:()=>void this.router.navigate(['/students',this.studentId],{state:{notice:'Student details updated.'}}),error:e=>{this.error=StudentsService.errorMessage(e,'Student details could not be saved.');}});
  }
  protected display(value:string):string{return value?.trim()||'Not provided';}
  private readonly fieldsByStep=[
    ['fullName','gradeOrYear'],['guardianName','guardianRelationship','guardianEmail'],['country','stateOrProvince','city','timeZoneId','timezoneConfirmed'],['preferredTeachingLanguage'],['teachingMode','duration'],[]
  ];
  private validAvailability():boolean{return this.availability.controls.every(row=>{const v=row.getRawValue();return !!v.dayOfWeek&&!!v.startLocalTime&&!!v.endLocalTime&&v.endLocalTime>v.startLocalTime;});}
  private getTimeZones():string[]{const intl=Intl as unknown as {supportedValuesOf?:(key:'timeZone')=>string[]};return intl.supportedValuesOf?.('timeZone')??['Asia/Kolkata','Australia/Melbourne','Europe/London','America/New_York','UTC'];}
  private clean(value:string):string{return value.trim().replace(/\s+/g,' ');}
  private toApiTime(value:string):string{return /^\d{2}:\d{2}$/.test(value)?value+":00":value;}
  private optional(value:string):string|null{return value.trim()||null;}
}











