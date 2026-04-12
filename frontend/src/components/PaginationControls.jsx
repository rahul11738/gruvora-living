/**
 * PaginationControls Component
 * Reusable pagination UI with Previous/Next buttons
 * 
 * Usage:
 * <PaginationControls 
 *   page={page} 
 *   pages={pages} 
 *   onPageChange={goToPage}
 * />
 */

import React from 'react';
import './PaginationControls.css';

const PaginationControls = ({
    page = 1,
    pages = 1,
    total = 0,
    loading = false,
    onPageChange = () => { },
    showItemsPerPage = false,
    onItemsPerPageChange = () => { },
    itemsPerPage = 20,
}) => {
    const itemsPerPageOptions = [10, 20, 50, 100];
    const startItem = (page - 1) * itemsPerPage + 1;
    const endItem = Math.min(page * itemsPerPage, total);

    const handlePrevious = () => {
        if (page > 1) {
            onPageChange(page - 1);
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleNext = () => {
        if (page < pages) {
            onPageChange(page + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePageInput = (e) => {
        const value = parseInt(e.target.value, 10);
        if (value >= 1 && value <= pages) {
            onPageChange(value);
        }
    };

    return (
        <div className="pagination-controls">
            <div className="pagination-info">
                {total > 0 ? (
                    <span className="items-range">
                        Showing {startItem}–{endItem} of {total}
                    </span>
                ) : (
                    <span className="items-range">No items</span>
                )}
            </div>

            <div className="pagination-actions">
                {/* Previous Button */}
                <button
                    className="pagination-btn pagination-btn-prev"
                    onClick={handlePrevious}
                    disabled={page === 1 || loading}
                    aria-label="Previous page"
                    title="Previous page"
                >
                    ← Previous
                </button>

                {/* Page Indicator */}
                <div className="pagination-page-info">
                    <input
                        type="number"
                        min="1"
                        max={pages}
                        value={page}
                        onChange={handlePageInput}
                        disabled={loading}
                        className="page-input"
                        aria-label="Current page"
                    />
                    <span className="page-separator">/</span>
                    <span className="total-pages">{pages}</span>
                </div>

                {/* Next Button */}
                <button
                    className="pagination-btn pagination-btn-next"
                    onClick={handleNext}
                    disabled={page === pages || loading}
                    aria-label="Next page"
                    title="Next page"
                >
                    Next →
                </button>
            </div>

            {/* Items Per Page Selector (Optional) */}
            {showItemsPerPage && (
                <div className="items-per-page-selector">
                    <label htmlFor="items-per-page">Items per page:</label>
                    <select
                        id="items-per-page"
                        value={itemsPerPage}
                        onChange={(e) => onItemsPerPageChange(parseInt(e.target.value, 10))}
                        disabled={loading}
                    >
                        {itemsPerPageOptions.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading && <div className="pagination-loading">Loading...</div>}
        </div>
    );
};

export default PaginationControls;
