import Foundation
import Capacitor
import HealthKit

@objc(TabroHealthPlugin)
public class TabroHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TabroHealthPlugin"
    public let jsName = "TabroHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSummary", returnType: CAPPluginReturnPromise)
    ]
    private let store = HKHealthStore()
    private let calendar = Calendar.current
    private func dayKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
    @objc public func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let steps = HKQuantityType.quantityType(forIdentifier: .stepCount),
              let sleep = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis),
              let energy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
              let exercise = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime) else {
            call.reject("Health data unavailable")
            return
        }
        store.requestAuthorization(toShare: [], read: [steps, sleep, energy, exercise]) { completed, error in
            if let error = error { call.reject(error.localizedDescription); return }
            // Completion does not prove that read permission was granted.
            call.resolve(["requested": completed])
        }
    }
    @objc public func readSummary(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.reject("Health data unavailable"); return }
        Task {
            do {
                let end = Date()
                let start = calendar.date(byAdding: .day, value: -29, to: calendar.startOfDay(for: end))!
                let steps = try await readSteps(start, end)
                let energy = try await readSteps(start, end, identifier: .activeEnergyBurned, unit: .kilocalorie())
                let exercise = try await readSteps(start, end, identifier: .appleExerciseTime, unit: .minute())
                let intervals = try await readSleep(start, end)
                var combined: [(Date, Date)] = []
                for range in intervals.sorted(by: { $0.0 < $1.0 }) {
                    if let last = combined.last, range.0 <= last.1 {
                        combined[combined.count - 1] = (last.0, max(last.1, range.1))
                    } else { combined.append(range) }
                }
                var sleep: [String: [(Date, Date)]] = [:]
                for interval in combined { sleep[dayKey(interval.1), default: []].append(interval) }
                let dates = Set(steps.keys).union(sleep.keys).union(energy.keys).union(exercise.keys).sorted(by: >)
                let rows: [[String: Any]] = dates.map { date in
                    let ranges = (sleep[date] ?? []).sorted { $0.0 < $1.0 }
                    var merged: [(Date, Date)] = []
                    for range in ranges {
                        if let last = merged.last, range.0 <= last.1 {
                            merged[merged.count - 1] = (last.0, max(last.1, range.1))
                        } else { merged.append(range) }
                    }
                    let hours = merged.reduce(0.0) { $0 + $1.1.timeIntervalSince($1.0) } / 3600
                    return ["date": date, "steps": steps[date].map { $0 as Any } ?? NSNull(),
                            "activeCalories": energy[date].map { $0 as Any } ?? NSNull(),
                            "exerciseMinutes": exercise[date].map { $0 as Any } ?? NSNull(),
                            "sleepHours": ranges.isEmpty ? NSNull() : NSNumber(value: (hours * 10).rounded() / 10)]
                }
                call.resolve(["days": rows])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    private func readSteps(_ start: Date, _ end: Date, identifier: HKQuantityTypeIdentifier = .stepCount, unit: HKUnit = .count()) async throws -> [String: Double] {
        let type = HKQuantityType.quantityType(forIdentifier: identifier)!
        return try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end)
            let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate,
                options: .cumulativeSum, anchorDate: calendar.startOfDay(for: start), intervalComponents: DateComponents(day: 1))
            query.initialResultsHandler = { _, collection, error in
                if let error = error { continuation.resume(throwing: error); return }
                var days: [String: Double] = [:]
                collection?.enumerateStatistics(from: start, to: end) { statistic, _ in
                    if let quantity = statistic.sumQuantity() { days[self.dayKey(statistic.startDate)] = quantity.doubleValue(for: unit) }
                }
                continuation.resume(returning: days)
            }
            store.execute(query)
        }
    }
    private func readSleep(_ start: Date, _ end: Date) async throws -> [(Date, Date)] {
        let type = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(sampleType: type, predicate: HKQuery.predicateForSamples(withStart: start, end: end),
                                      limit: 10000, sortDescriptors: nil) { _, samples, error in
                if let error = error { continuation.resume(throwing: error); return }
                // 0=in bed and 2=awake are deliberately excluded.
                let intervals = (samples as? [HKCategorySample] ?? []).filter {
                    [1, 3, 4, 5].contains($0.value) && $0.endDate.timeIntervalSince($0.startDate) <= 86400
                }.map { ($0.startDate, $0.endDate) }
                continuation.resume(returning: intervals)
            }
            store.execute(query)
        }
    }
}
