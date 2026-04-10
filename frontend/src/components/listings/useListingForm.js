import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { listingsAPI } from '../../lib/api';

const DRAFT_KEY = (role) => `listing_draft_${role}`;

export function useListingForm({ category, role, buildPayload, onSuccess }) {
  const [step, setStep] = useState(0);
  const [baseData, setBaseData] = useState({
    title: '',
    description: '',
    location: '',
    city: '',
    state: 'Gujarat',
    contact_phone: '',
    contact_email: '',
    pricing: { type: 'fixed', amount: '', negotiable: false },
    media: { images: [], videos: [] },
    is_draft: false,
  });
  const [specificData, setSpecificData] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const saveDraft = useCallback(() => {
    localStorage.setItem(DRAFT_KEY(role), JSON.stringify({ baseData, specificData }));
    toast.success('Draft saved', { duration: 1200, id: 'draft-save' });
  }, [baseData, specificData, role]);

  const loadDraft = useCallback(() => {
    const raw = localStorage.getItem(DRAFT_KEY(role));
    if (!raw) return false;
    try {
      const { baseData: base, specificData: specific } = JSON.parse(raw);
      setBaseData(base);
      setSpecificData(specific);
      return true;
    } catch {
      return false;
    }
  }, [role]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload(baseData, specificData, category);
      const response = await listingsAPI.create(payload);
      localStorage.removeItem(DRAFT_KEY(role));
      
      const { status, payment_required, fee_amount_paise, listing_id } = response.data;
      
      if (status === 'awaiting_payment' || status === 'AWAITING_PAYMENT') {
        toast.success('Listing created! Please complete payment to publish.');
        onSuccess?.({ 
          status: 'awaiting_payment', 
          payment_required, 
          fee_amount_paise, 
          listing_id 
        });
      } else {
        toast.success('Listing created! Pending admin approval.');
        onSuccess?.({ status });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail?.category_specific_errors) {
        const nextErrors = {};
        detail.category_specific_errors.forEach((entry) => {
          nextErrors[entry.field] = entry.msg;
        });
        setErrors(nextErrors);
        toast.error('Fix the highlighted fields');
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Failed to create listing');
      }
    } finally {
      setSubmitting(false);
    }
  }, [baseData, specificData, buildPayload, category, role, onSuccess]);

  return {
    step,
    setStep,
    baseData,
    setBaseData,
    specificData,
    setSpecificData,
    errors,
    setErrors,
    submitting,
    saveDraft,
    loadDraft,
    submit,
  };
}
