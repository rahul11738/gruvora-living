import { useEffect } from 'react';
import { ChevronRight, Save } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { SERVICE_TYPES } from '../../lib/listingSchemas';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useListingForm } from './useListingForm';
import BasicStep from './steps/BasicStep';
import MediaStep from './steps/MediaStep';
import PricingStep from './steps/PricingStep';

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function buildPayload(base, specific, category) {
  return {
    ...base,
    category,
    category_specific_fields: specific,
    media: {
      ...base.media,
      images: (base.media?.images || []).map((image) => (typeof image === 'string' ? image : image.url)),
    },
    pricing: {
      ...base.pricing,
      type: specific.pricing_type || 'fixed',
      amount: parseFloat(base.pricing.amount || 0),
    },
  };
}

export default function ServiceForm({ category, onSuccess }) {
  const { user } = useAuth();
  const {
    step,
    setStep,
    baseData,
    setBaseData,
    specificData,
    setSpecificData,
    submitting,
    saveDraft,
    loadDraft,
    submit,
  } = useListingForm({ category, role: user?.role, buildPayload, onSuccess });

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const slots = specificData.availability_slots || [];

  const toggleDay = (day) => {
    const exists = slots.find((slot) => slot.day === day);
    if (exists) {
      setSpecificData((prev) => ({ ...prev, availability_slots: slots.filter((slot) => slot.day !== day) }));
    } else {
      setSpecificData((prev) => ({ ...prev, availability_slots: [...slots, { day, start: '09:00', end: '18:00' }] }));
    }
  };

  return (
    <div className="space-y-6">
      {step === 0 && <BasicStep baseData={baseData} setBaseData={setBaseData} />}

      {step === 1 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Service type</Label>
              <Select value={specificData.service_type || ''} onValueChange={(value) => setSpecificData((prev) => ({ ...prev, service_type: value }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pricing type</Label>
              <Select value={specificData.pricing_type || ''} onValueChange={(value) => setSpecificData((prev) => ({ ...prev, pricing_type: value }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="quote_based">Quote based</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Experience (years)</Label>
              <Input type="number" value={specificData.experience_years || ''} onChange={(e) => setSpecificData((prev) => ({ ...prev, experience_years: parseInt(e.target.value || '0', 10) }))} className="mt-1" />
            </div>
            <div>
              <Label>Radius (km)</Label>
              <Input type="number" value={specificData.service_radius_km || ''} onChange={(e) => setSpecificData((prev) => ({ ...prev, service_radius_km: parseFloat(e.target.value || '0') }))} className="mt-1" />
            </div>
            <div>
              <Label>Team size</Label>
              <Input type="number" value={specificData.team_size || ''} onChange={(e) => setSpecificData((prev) => ({ ...prev, team_size: parseInt(e.target.value || '1', 10) }))} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Skills (comma separated)</Label>
            <Input
              value={(specificData.skills || []).join(', ')}
              onChange={(e) => setSpecificData((prev) => ({ ...prev, skills: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) }))}
              className="mt-1"
            />
          </div>

          <div className="space-y-2">
            <Label>Availability slots</Label>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day) => {
                const active = slots.some((slot) => slot.day === day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      active ? 'bg-primary text-white border-primary' : 'border-stone-200 text-stone-600'
                    }`}
                  >
                    {day.toUpperCase()}
                  </button>
                );
              })}
            </div>
            {slots.map((slot, index) => (
              <div key={slot.day} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm font-medium capitalize">{slot.day}</span>
                <Input
                  type="time"
                  value={slot.start}
                  onChange={(e) => {
                    const next = [...slots];
                    next[index] = { ...next[index], start: e.target.value };
                    setSpecificData((prev) => ({ ...prev, availability_slots: next }));
                  }}
                />
                <Input
                  type="time"
                  value={slot.end}
                  onChange={(e) => {
                    const next = [...slots];
                    next[index] = { ...next[index], end: e.target.value };
                    setSpecificData((prev) => ({ ...prev, availability_slots: next }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 2 && <MediaStep baseData={baseData} setBaseData={setBaseData} label="Portfolio images" />}
      {step === 3 && <PricingStep baseData={baseData} setBaseData={setBaseData} />}

      <div className="flex items-center justify-between pt-4 border-t border-stone-100">
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
          <Button variant="ghost" size="sm" onClick={saveDraft}><Save className="w-4 h-4 mr-1" /> Save draft</Button>
        </div>
        {step < 3 ? (
          <Button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
        ) : (
          <Button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Publish listing'}</Button>
        )}
      </div>
    </div>
  );
}
