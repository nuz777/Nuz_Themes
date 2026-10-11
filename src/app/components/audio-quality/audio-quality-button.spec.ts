import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioQualityButton } from './audio-quality-button';
import { AudioQualityService } from '../../services/audio-quality.service';
import { ToastService } from '../../services/toast.service';

describe('AudioQualityButton', () => {
  let component: AudioQualityButton;
  let fixture: ComponentFixture<AudioQualityButton>;
  let qualityService: AudioQualityService;

  beforeEach(async () => {
    localStorage.removeItem('nuz-audio-quality');
    await TestBed.configureTestingModule({
      imports: [AudioQualityButton],
      providers: [AudioQualityService, ToastService],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioQualityButton);
    component = fixture.componentInstance;
    qualityService = TestBed.inject(AudioQualityService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem('nuz-audio-quality');
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render trigger button with transparency and blur classes', () => {
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('backdrop-blur-md');
    expect(btn.className).toContain('bg-white/10');
  });

  it('should open modal through qualityService when clicked', () => {
    expect(qualityService.isModalOpen()).toBe(false);
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(qualityService.isModalOpen()).toBe(true);
  });

  it('should reflect current quality badge', () => {
    qualityService.setQuality('baja', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Baja');

    qualityService.setQuality('alta', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Alta');
  });
});
