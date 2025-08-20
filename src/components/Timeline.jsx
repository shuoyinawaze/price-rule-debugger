import React, { useRef, useEffect, useState, useMemo } from 'react';
import { parseISO, differenceInCalendarDays, format } from 'date-fns';
import XMLPopup from './XMLPopup.jsx';

export default function Timeline({
  rules, year, highlightedRuleIds, bookingCreationDate,
  viewMode, selectedMonth, onMonthClick, onNavigateMonth, onBackToYear,
  saleabilityData, isDarkMode, ruleYears
}) {
  const isYearView = viewMode === 'year';
  const [selectedRule, setSelectedRule] = useState(null); // For XML popup

  // 1. 用 ref 拿 info 和 bar 宽度
  const infoRef = useRef(null);
  const barRef = useRef(null);
  const [infoWidth, setInfoWidth] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  // 2. 自动监听窗口变化，动态获取宽度
  useEffect(() => {
    function updateWidths() {
      if (infoRef.current) setInfoWidth(infoRef.current.offsetWidth);
      if (barRef.current) setBarWidth(barRef.current.offsetWidth);
    }
    updateWidths();
    window.addEventListener('resize', updateWidths);
    return () => window.removeEventListener('resize', updateWidths);
  }, []);

  // 3. 时间范围
  const { start, end, totalDays } = useMemo(() => {
    if (isYearView) {
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      return {
        start: yearStart,
        end: yearEnd,
        totalDays: differenceInCalendarDays(yearEnd, yearStart) + 1
      };
    } else {
      const monthStart = new Date(year, selectedMonth, 1);
      const monthEnd = new Date(year, selectedMonth + 1, 0);
      return {
        start: monthStart,
        end: monthEnd,
        totalDays: differenceInCalendarDays(monthEnd, monthStart) + 1
      };
    }
  }, [year, selectedMonth, isYearView]);

  // 4. Header ticks
  const headerTicks = useMemo(() => {
    const ticks = [];
    if (isYearView) {
      for (let month = 0; month < 12; month++) {
        const date = new Date(year, month, 1);
        const idx = differenceInCalendarDays(date, start);
        ticks.push({
          index: idx,
          label: date.toLocaleString('default', { month: 'short' }),
          month,
          clickable: true
        });
      }
    } else {
      for (let day = 1; day <= totalDays; day++) {
        ticks.push({
          index: day - 1,
          label: day.toString(),
          clickable: false
        });
      }
    }
    return ticks;
  }, [year, start, isYearView, selectedMonth, totalDays]);

  // 5. booking creation 红线逻辑
  const bookingDatePosition = useMemo(() => {
    if (!bookingCreationDate) return null;
    const dayIndex = differenceInCalendarDays(bookingCreationDate, start);
    if (dayIndex < 0 || dayIndex >= totalDays) return null;
    return (dayIndex / totalDays) * 100; // Return percentage directly
  }, [bookingCreationDate, start, totalDays]);

  return (
    <div className="timeline-wrapper">
      {/* Month nav */}
      {!isYearView && (
        <div className="timeline-navigation">
          <button
            onClick={() => onNavigateMonth(-1)}
            disabled={selectedMonth === 0 && (!ruleYears || year <= ruleYears.min)}
            className="nav-button"
          >
            ← Previous
          </button>
          <span className="current-month">
            {new Date(year, selectedMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => onNavigateMonth(1)}
            disabled={selectedMonth === 11 && (!ruleYears || year >= ruleYears.max)}
            className="nav-button"
          >
            Next →
          </button>
          <button onClick={onBackToYear} className="back-button">
            Back to Year View
          </button>
        </div>
      )}
      {/* Header */}
      <div className="timeline-header" style={{ display: 'flex' }}>
        <div
          className="rule-info-spacer"
          ref={infoRef}
          style={{ width: '30%', minWidth: '200px', maxWidth: '300px' }}
        ></div>
        <div
          className="timeline-markers-container"
          ref={barRef}
          style={{ flex: 1, position: 'relative' }}
        >
          {headerTicks.map((tick) => (
            <div
              key={tick.index}
              className={`timeline-marker ${tick.clickable ? 'clickable' : ''}`}
              style={{ left: `${(tick.index / totalDays) * 100}%` }}
              onClick={tick.clickable ? () => onMonthClick(tick.month) : undefined}
              title={tick.clickable ? `Click to view ${tick.label} in detail` : undefined}
            >
              {tick.label}
            </div>
          ))}
          {/* 红线，绝对定位 */}
          {bookingDatePosition !== null && (
            <div
              className="booking-creation-line"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${bookingDatePosition}%`
              }}
              title={`Booking creation date: ${format(bookingCreationDate, 'yyyy-MM-dd')}`}
            >
              <div className="booking-creation-label">
                {format(bookingCreationDate, 'MMM d')}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* rule bar rows */}
      <div className="rule-rows">
        {/* Availability overlay */}
        {saleabilityData && (
          <div className="availability-overlay-row">
            <div className="rule-info">
              <div className="rule-title">Saleability From APEX</div>
              <div className="rule-dates">Saleable dates</div>
              <div className="rule-details">{isDarkMode ? 'White' : 'Black'} = Saleable</div>
            </div>
            <div className="rule-bar-container">
              {/* Render availability blocks */}
              {Array.from({ length: totalDays }, (_, dayIndex) => {
                const currentDate = new Date(start);
                currentDate.setDate(currentDate.getDate() + dayIndex);
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                
                // Check if this date has any availability
                const hasAvailability = saleabilityData.data?.saleability?.[dateKey] && 
                                      saleabilityData.data.saleability[dateKey].length > 0;
                
                if (hasAvailability) {
                  const barLeft = (dayIndex / totalDays) * 100;
                  const barWidth = (1 / totalDays) * 100;
                  
                  return (
                    <div
                      key={dayIndex}
                      className="available-day"
                      style={{
                        left: `${barLeft}%`,
                        width: `${barWidth}%`,
                      }}
                      title={`${dateKey} - Available`}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
        
        {rules.map((rule) => {
          let ruleStartIdx = differenceInCalendarDays(parseISO(rule.from), start);
          let ruleEndIdx = differenceInCalendarDays(parseISO(rule.to), start);
          
          // Also check if maxDaysToArrival period intersects with current view
          let shadowStartIdx = null;
          let shadowEndIdx = null;
          if (rule.maxDaysToArrival != null) {
            const ruleFromDate = parseISO(rule.from);
            const shadowEnd = new Date(ruleFromDate);
            shadowEnd.setDate(shadowEnd.getDate() - 1); // End one day before rule starts
            const shadowStart = new Date(shadowEnd);
            shadowStart.setDate(shadowStart.getDate() - rule.maxDaysToArrival + 1); // X days before the end
            
            shadowStartIdx = differenceInCalendarDays(shadowStart, start);
            shadowEndIdx = differenceInCalendarDays(shadowEnd, start);
          }
          
          // Show rule if either the rule period OR the maxDaysToArrival period intersects with current view
          const ruleIntersects = !(ruleEndIdx < 0 || ruleStartIdx > totalDays - 1);
          const shadowIntersects = shadowStartIdx !== null && shadowEndIdx !== null && 
                                  !(shadowEndIdx < 0 || shadowStartIdx > totalDays - 1);
          
          if (!ruleIntersects && !shadowIntersects) return null;
          
          ruleStartIdx = Math.max(0, ruleStartIdx);
          ruleEndIdx = Math.min(totalDays - 1, ruleEndIdx);
          const barLeft = (ruleStartIdx / totalDays) * 100;
          const barWidthPercent = ((ruleEndIdx - ruleStartIdx + 1) / totalDays) * 100;
          const highlight = highlightedRuleIds && highlightedRuleIds.includes(rule.id);
          
          // Calculate max days to arrival shadow if applicable
          let shadowOverlay = null;
          if (rule.maxDaysToArrival != null && shadowIntersects) {
            // Use the already calculated shadow indices
            const visibleStartIdx = Math.max(0, shadowStartIdx);
            const visibleEndIdx = Math.min(totalDays - 1, shadowEndIdx);
            
            if (visibleStartIdx <= visibleEndIdx) {
              const shadowLeft = (visibleStartIdx / totalDays) * 100;
              const shadowWidth = ((visibleEndIdx - visibleStartIdx + 1) / totalDays) * 100;
              
              const ruleFromDate = parseISO(rule.from);
              const shadowEnd = new Date(ruleFromDate);
              shadowEnd.setDate(shadowEnd.getDate() - 1);
              const shadowStart = new Date(shadowEnd);
              shadowStart.setDate(shadowStart.getDate() - rule.maxDaysToArrival + 1);
              
              shadowOverlay = (
                <div
                  className="max-days-shadow"
                  style={{
                    left: `${shadowLeft}%`,
                    width: `${shadowWidth}%`,
                  }}
                  title={`Booking window (${rule.maxDaysToArrival} days): ${format(shadowStart, 'MMM d, yyyy')} to ${format(shadowEnd, 'MMM d, yyyy')} for rule starting ${format(ruleFromDate, 'MMM d, yyyy')}`}
                />
              );
            }
          }
          
          return (
            <div className="rule-row" key={rule.id}>
              <div 
                className="rule-info clickable-rule"
                onClick={() => setSelectedRule(rule)}
                title="Click to view original XML"
              >
                <div className="rule-title">Rule {rule.id}</div>
                <div className="rule-dates">
                  {format(parseISO(rule.from), 'yyyy-MM-dd')} – {format(parseISO(rule.to), 'yyyy-MM-dd')}
                </div>
                <div className="rule-details">
                  Min stay {rule.minStay}, Max stay {rule.maxStay}
                  {rule.maxDaysToArrival != null
                    ? `, Max days to arrival ${rule.maxDaysToArrival}`
                    : ', No max days to arrival'}
                </div>
              </div>
              <div className="rule-bar-container">
                {shadowOverlay}
                {ruleIntersects && (
                  <div
                    className={`rule-bar ${highlight ? 'highlight' : ''} clickable-rule`}
                    style={{
                      left: `${barLeft}%`,
                      width: `${barWidthPercent}%`,
                      backgroundColor: rule.colour,
                    }}
                    title={`Rule ${rule.id} - Click to view XML`}
                    onClick={() => setSelectedRule(rule)}
                  ></div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* XML Popup Modal */}
      {selectedRule && (
        <XMLPopup 
          rule={selectedRule} 
          onClose={() => setSelectedRule(null)} 
        />
      )}
    </div>
  );
}
