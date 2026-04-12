import React, { memo, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

const VirtualizedListings = memo(function VirtualizedListings({
    items,
    rowHeight = 248,
    height = 740,
    overscanCount = 5,
    renderItem,
}) {
    const itemData = useMemo(
        () => ({ items, renderItem }),
        [items, renderItem]
    );

    const Row = ({ index, style, data }) => {
        const item = data.items[index];
        return (
            <div style={style} className="px-1 py-2">
                {data.renderItem(item)}
            </div>
        );
    };

    return (
        <List
            height={height}
            itemCount={items.length}
            itemSize={rowHeight}
            width="100%"
            itemData={itemData}
            overscanCount={overscanCount}
        >
            {Row}
        </List>
    );
});

export default VirtualizedListings;
