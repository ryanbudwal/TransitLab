export class MinHeap<T> {
  private readonly values: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size() {
    return this.values.length;
  }

  push(value: T) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.values[index], this.values[parent]) >= 0) break;
      [this.values[index], this.values[parent]] = [
        this.values[parent],
        this.values[index],
      ];
      index = parent;
    }
  }

  pop(): T | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (this.values.length > 0 && last !== undefined) {
      this.values[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (
          left < this.values.length &&
          this.compare(this.values[left], this.values[smallest]) < 0
        )
          smallest = left;
        if (
          right < this.values.length &&
          this.compare(this.values[right], this.values[smallest]) < 0
        )
          smallest = right;
        if (smallest === index) break;
        [this.values[index], this.values[smallest]] = [
          this.values[smallest],
          this.values[index],
        ];
        index = smallest;
      }
    }
    return first;
  }
}
