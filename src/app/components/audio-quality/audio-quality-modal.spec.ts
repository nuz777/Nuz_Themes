import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioQualityModal } from './audio-quality-modal';
import { AudioService } from '../../services/audio.service';
import { AudioQualityService } from '../../services/audio-quality.service';
import { ToastService } from '../../services/toast.service';

describe('AudioQualityModal', () => {
  let component: AudioQualityModal;
  let fixture: ComponentFixture<AudioQualityModal>;
  let qualityService: AudioQualityService;

  beforeEach(async () => {
    localStorage.removeItem('nuz-audio-quality');
    await TestBed.configureTestingModule({
      imports: [AudioQualityModal],
      providers: [AudioService, AudioQualityService, ToastService],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioQualityModal);
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

  it('should not render dialog when isModalOpen is false', () => {
    qualityService.closeModal();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('should render dialog with transparency and blur when isModalOpen is true', () => {
    qualityService.openModal();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.className).toContain('backdrop-blur-md');

    const card = dialog.querySelector('.backdrop-blur-2xl');
    expect(card).toBeTruthy();
    expect(dialog.className).toContain('animate-quality-modal-backdrop');
    expect(card.className).toContain('animate-quality-modal-card');
  });

  it('should display the 3 options and the explicit warning for alta', () => {
    qualityService.openModal();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Baja');
    expect(text).toContain('Media');
    expect(text).toContain('Alta');
    expect(text.toLowerCase()).toContain('excelente conexión');
  });

  it('should select quality and update state on click', () => {
    qualityService.openModal();
    fixture.detectChanges();

    component.selectQuality('baja');
    expect(qualityService.quality()).toBe('baja');

    component.selectQuality('alta');
    expect(qualityService.quality()).toBe('alta');
  });

  it('should close when close() is called', () => {
    qualityService.openModal();
    fixture.detectChanges();
    expect(component.isOpen).toBe(true);

    component.close();
    fixture.detectChanges();
    expect(component.isOpen).toBe(false);
  });
});
